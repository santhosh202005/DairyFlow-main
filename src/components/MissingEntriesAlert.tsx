import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Bell, AlertTriangle, ArrowRight, X, Clock, CheckCircle2, Droplets, Calendar, ChevronDown, ChevronUp, Search, ArrowLeft, RefreshCw } from 'lucide-react';
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

export function formatMissingDate(dateStr?: string): string {
  if (!dateStr) return '';
  const d = new Date(`${dateStr}T12:00:00`);
  return d.toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

const getLocalizedAnnouncementCategory = (category: string, t: (key: string) => string) => {
  const keys: Record<string, string> = {
    'Milk Delivery Update': 'milkDeliveryUpdate',
    'Delivery Delay': 'deliveryDelay',
    'Holiday Notice': 'holidayNotice',
    'Milk Rate Change': 'milkRateChange',
    'Monthly Bill Reminder': 'monthlyBillReminder',
    'General Announcement': 'generalAnnouncement',
  };
  return t(keys[category] || category);
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
      const params = new URLSearchParams();
      if (customerId) params.set('customerId', customerId);
      if (vendorId) params.set('vendorId', vendorId);
      const url = `/api/missing-entries${params.toString() ? `?${params.toString()}` : ''}`;

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
  onEnterMilk: (shift?: 'AM' | 'PM', customerId?: string, date?: string) => void;
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
        // Dismissed for current session
      }
    }
  };

  const handleEnter = () => {
    setIsDismissed(true);
    const firstShift = data.entries[0]?.shift || (data.amMissing ? 'AM' : 'PM');
    const firstCustId = data.entries[0]?.customerId ? String(data.entries[0].customerId) : undefined;
    const firstDate = data.entries[0]?.date || undefined;
    onEnterMilk(firstShift, firstCustId, firstDate);
  };

  const isCustomer = role === 'customer';
  const modalTitle = isCustomer ? t('milkEntryMissingTitle') : t('missingMilkEntryTitle');

  return (
    <AnimatePresence>
      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-[84] flex justify-center px-2 sm:inset-auto sm:bottom-5 sm:right-5 sm:justify-end sm:px-0">
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 15 }}
          role="dialog"
          aria-modal="false"
          aria-labelledby="missing-entries-title"
          className="pointer-events-auto flex max-h-[min(62dvh,30rem)] w-[min(28rem,calc(100vw-1rem))] min-w-0 flex-col overflow-hidden rounded-2xl border border-amber-200 bg-white shadow-2xl sm:max-h-[min(70dvh,34rem)] sm:rounded-3xl"
        >
          {/* Top amber banner */}
          <div className="flex shrink-0 items-center justify-between gap-3 bg-gradient-to-r from-amber-500 to-orange-500 px-3 py-3 text-white sm:px-5 sm:py-4">
            <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/20 text-lg backdrop-blur-md sm:h-10 sm:w-10 sm:rounded-2xl sm:text-xl">
                ⚠️
              </div>
              <div className="min-w-0">
                <h3 id="missing-entries-title" className="text-sm font-bold font-display leading-tight sm:text-base">{modalTitle}</h3>
                <p className="text-amber-100 text-xs font-medium">{t('sessionMilkCollectionAlert')}</p>
              </div>
            </div>
            <button
              onClick={handleLater}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full p-1.5 text-white/80 transition-colors hover:bg-white/10 hover:text-white"
              title={t('close')}
              aria-label={t('close')}
            >
              <X size={18} />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 sm:p-4">
            <div className="space-y-2">
              {data.entries.slice(0, 6).map((entry, idx) => (
                <div
                  key={`${entry.customerId ?? 'self'}_${entry.date}_${entry.shift}_${idx}`}
                  className="flex items-start gap-2.5 rounded-xl border border-amber-200/70 bg-amber-50/80 p-2.5 text-slate-800 sm:gap-3 sm:rounded-2xl sm:p-3"
                >
                  <span className={`mt-0.5 shrink-0 rounded-lg px-2 py-0.5 text-xs font-extrabold uppercase ${
                    entry.shift === 'AM' ? 'bg-amber-200 text-amber-900' : 'bg-orange-200 text-orange-900'
                  }`}>
                    {entry.shift}
                  </span>
                  <div className="min-w-0 flex-1 break-words text-xs font-semibold leading-snug sm:text-sm">
                    <div>{entry.customerName ? `${entry.customerName} - ${entry.shift} entry missing` : `${entry.shift} milk entry missing`}</div>
                    {entry.date && (
                      <div className="mt-1 flex items-center gap-1.5 text-[11px] font-normal text-slate-500">
                        <Calendar size={11} />
                        <span>{formatMissingDate(entry.date)}</span>
                        {entry.daysOverdue !== undefined && entry.daysOverdue > 0 && (
                          <span className="font-semibold text-rose-600">({entry.daysOverdue}d overdue)</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {data.entries.length > 6 && (
                <p className="text-center text-xs text-slate-400">
                  +{data.entries.length - 6} more missing entries
                </p>
              )}
            </div>
            <p className="mt-3 text-xs text-slate-500">
              {t('submitMilkVolumeReminder')}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2 border-t border-slate-100 bg-slate-50 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:gap-3 sm:p-4">
            <button
              type="button"
              onClick={handleLater}
              className="min-h-10 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition-all hover:bg-slate-50 active:scale-[0.98] sm:text-sm"
            >
              {t('laterAction')}
            </button>
            <button
              type="button"
              onClick={handleEnter}
              className="flex min-h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-700 px-3 py-2 text-xs font-bold text-white shadow-lg shadow-emerald-600/25 transition-all hover:from-emerald-700 hover:to-emerald-800 active:scale-[0.98] sm:text-sm"
            >
              {isCustomer ? t('enterMilkNow') : t('enterMilk')}
              <ArrowRight size={16} />
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Alert Row Component (used in Notification Bell & Drawer)
// ─────────────────────────────────────────────────────────────────────────────
interface AlertRowProps {
  entry: MissingEntryItem;
  role: string | null;
  onEnterMilk: (shift?: 'AM' | 'PM', customerId?: string, date?: string) => void;
}

function AlertRow({ entry, role, onEnterMilk }: AlertRowProps) {
  const { t } = useTranslation();
  const isVendor = role === 'vendor';
  const customerName = entry.customerName || entry.label.match(
    /(?:AM|PM) milk entry missing:\s*(.+?)(?:\s+\(\d{4}-\d{2}-\d{2}\))?$/i
  )?.[1];

  return (
    <div className="flex items-center gap-2 rounded-xl border border-amber-200/70 bg-amber-50/60 px-3 py-2 text-slate-800 transition-colors hover:bg-amber-100/60 sm:gap-3 sm:py-2.5">
      {/* Shift Badge */}
      <span
        className={`shrink-0 rounded-lg px-2 py-1 text-[11px] font-black uppercase tracking-wider ${
          entry.shift === 'AM'
            ? 'bg-amber-200 text-amber-900 border border-amber-300'
            : 'bg-orange-200 text-orange-900 border border-orange-300'
        }`}
      >
        {entry.shift}
      </span>

      {/* Main Details */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          {isVendor && customerName && (
            <p className="break-words text-xs font-bold text-slate-900 sm:text-sm">
              {customerName}
              {entry.customerCode && (
                <span className="ml-1 text-[10px] font-semibold text-slate-400">
                  #{entry.customerCode}
                </span>
              )}
            </p>
          )}
          {!isVendor && (
            <p className="truncate text-xs font-bold text-slate-900 sm:text-sm">
              {entry.shift} Milk Entry
            </p>
          )}

          {/* Status Badge */}
          <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-700">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse" />
            {t('missingStatus')}
          </span>
        </div>

        {/* Date and Overdue line */}
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-500">
          <span className="flex items-center gap-1 font-medium text-slate-700">
            <Calendar size={11} className="text-slate-400" />
            {formatMissingDate(entry.date)}
          </span>
          <span className="text-slate-300">·</span>
          <span className="flex items-center gap-1 font-semibold">
            <Clock size={11} className="text-slate-400" />
            {entry.daysOverdue === 0 ? (
              <span className="text-red-600 font-bold">{t('overdueToday')}</span>
            ) : entry.daysOverdue === 1 ? (
              <span className="text-orange-600 font-bold">{t('overdueYesterday')}</span>
            ) : (
              <span className="text-slate-600">
                {(t('daysOverduePlural') || '{days} days overdue').replace('{days}', String(entry.daysOverdue))}
              </span>
            )}
          </span>
        </div>
      </div>

      {/* Quick Action Button */}
      <button
        type="button"
        onClick={() => onEnterMilk(entry.shift, entry.customerId ? String(entry.customerId) : undefined, entry.date)}
        className="shrink-0 flex items-center gap-1 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-700 px-3 py-1.5 text-xs font-bold text-white shadow-sm transition-all hover:from-emerald-700 hover:to-emerald-800 active:scale-95"
        title={`Add ${entry.shift} milk entry for ${entry.date}`}
      >
        <Droplets size={13} />
        <span>Add</span>
      </button>
    </div>
  );
}

interface AlertGroupCardProps {
  title: string;
  count: number;
  entries: MissingEntryItem[];
  role: string | null;
  onEnterMilk: (shift?: 'AM' | 'PM', customerId?: string, date?: string) => void;
  defaultExpanded?: boolean;
  colorScheme: 'red' | 'orange' | 'slate';
}

function AlertGroupCard({
  title,
  count,
  entries,
  role,
  onEnterMilk,
  defaultExpanded = true,
  colorScheme,
}: AlertGroupCardProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [displayLimit, setDisplayLimit] = useState(25);

  if (count === 0) return null;

  const headerColors = {
    red: 'bg-rose-50/90 text-rose-900 border-rose-200',
    orange: 'bg-orange-50/90 text-orange-900 border-orange-200',
    slate: 'bg-slate-100/80 text-slate-800 border-slate-200',
  };

  const badgeColors = {
    red: 'bg-rose-600 text-white',
    orange: 'bg-orange-600 text-white',
    slate: 'bg-slate-600 text-white',
  };

  const visibleEntries = entries.slice(0, displayLimit);
  const hasMore = entries.length > displayLimit;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className={`w-full flex items-center justify-between gap-3 px-3.5 py-2.5 sm:px-4 sm:py-3 transition-colors ${headerColors[colorScheme]}`}
        aria-expanded={isExpanded}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-black ${badgeColors[colorScheme]}`}>
            {count}
          </span>
          <span className="min-w-0 text-left text-xs font-bold leading-snug break-words sm:text-sm">{title}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0 text-slate-500">
          <span className="text-[11px] font-semibold hidden sm:inline">
            {isExpanded ? 'Hide' : 'Show'}
          </span>
          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </button>

      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div className="p-2 sm:p-3 space-y-1.5 sm:space-y-2 max-h-[28rem] overflow-y-auto overscroll-contain">
              {visibleEntries.map((entry, idx) => (
                <AlertRow
                  key={`${entry.customerId ?? 'self'}-${entry.date}-${entry.shift}-${idx}`}
                  entry={entry}
                  role={role}
                  onEnterMilk={onEnterMilk}
                />
              ))}

              {hasMore && (
                <div className="pt-2 text-center flex items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => setDisplayLimit((prev) => Math.min(prev + 50, entries.length))}
                    className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors shadow-sm"
                  >
                    Load More ({entries.length - displayLimit} remaining)
                  </button>
                  <button
                    type="button"
                    onClick={() => setDisplayLimit(entries.length)}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-500 hover:bg-slate-50 transition-colors"
                  >
                    Show All ({entries.length})
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Notification Bell Icon in Header with Complete Alert Dashboard Inside
// ─────────────────────────────────────────────────────────────────────────────
interface NotificationBellProps {
  data: MissingEntriesResponse | null;
  role: string | null;
  onEnterMilk: (shift?: 'AM' | 'PM', customerId?: string, date?: string) => void;
  onNavigate?: (view: any) => void;
  activeView?: string;
  isPage?: boolean;
  announcementSessionToken?: string;
  onSessionExpired: () => void;
}

interface CustomerAnnouncementNotification {
  recipient_id: string;
  announcement_id: string;
  title: string;
  message: string;
  category?: string;
  vendor_name: string;
  in_app_read_status: 'unread' | 'read';
  created_at: string;
}

async function readNotificationPayload(response: Response, endpoint: string) {
  const contentType = response.headers.get('content-type') || '';
  const responseText = await response.text();
  if (!contentType.includes('application/json')) {
    throw new Error(
      `The notification API "${endpoint}" is not available on the deployed backend. ` +
      'Deploy the latest server.ts to Render and restart the service.',
    );
  }
  try {
    return JSON.parse(responseText);
  } catch {
    throw new Error(`The notification API "${endpoint}" returned invalid JSON.`);
  }
}

export function NotificationBell({
  data,
  role,
  onEnterMilk,
  onNavigate,
  activeView,
  isPage = false,
  announcementSessionToken,
  onSessionExpired,
}: NotificationBellProps) {
  const { t, lang } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [notifications, setNotifications] = useState<CustomerAnnouncementNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationFilter, setNotificationFilter] = useState<'all' | 'unread'>('all');
  const [expandedNotification, setExpandedNotification] = useState<string | null>(null);
  const [notificationError, setNotificationError] = useState('');
  const [isLoadingNotifications, setIsLoadingNotifications] = useState(false);
  const onSessionExpiredRef = useRef(onSessionExpired);
  const hasAnnouncementInbox = role === 'customer' || role === 'worker' || role === 'vendor';
  const announcementCount = hasAnnouncementInbox ? unreadCount : 0;
  const alertCount = role === 'customer' || role === 'vendor' ? (data?.count || 0) : 0;
  const count = alertCount + announcementCount;
  const hasAlerts = count > 0;

  // Active sub-tab in notification dialog: 'alerts' or 'announcements'
  const [activeTab, setActiveTab] = useState<'alerts' | 'announcements'>(() => {
    return alertCount > 0 ? 'alerts' : 'announcements';
  });

  useEffect(() => {
    if (alertCount > 0 && activeTab !== 'alerts') {
      setActiveTab('alerts');
    }
  }, [alertCount]);

  const visibleNotifications = notificationFilter === 'unread'
    ? notifications.filter((item) => item.in_app_read_status === 'unread')
    : notifications;

  useEffect(() => {
    onSessionExpiredRef.current = onSessionExpired;
  }, [onSessionExpired]);

  const fetchAnnouncements = useCallback(async (includeList: boolean) => {
    if (!hasAnnouncementInbox || !announcementSessionToken) return;
    setNotificationError('');
    setIsLoadingNotifications(includeList);
    try {
      const headers = { Authorization: `Bearer ${announcementSessionToken}` };
      const basePath = role === 'worker'
        ? '/api/worker/announcements'
        : role === 'vendor' ? '/api/vendor/messages' : '/api/announcements';
      const countResponse = await fetch(`${basePath}/unread-count`, { headers });
      if (countResponse.status === 401) {
        onSessionExpiredRef.current();
        return;
      }
      if (!countResponse.ok) throw new Error(`Unable to refresh notification count (${countResponse.status})`);
      const countPayload = await readNotificationPayload(countResponse, `${basePath}/unread-count`);
      setUnreadCount(Number(countPayload.count) || 0);

      if (includeList) {
        const listResponse = await fetch(basePath, { headers });
        if (listResponse.status === 401) {
          onSessionExpiredRef.current();
          return;
        }
        if (!listResponse.ok) throw new Error(`Unable to load notifications (${listResponse.status})`);
        const listPayload = await readNotificationPayload(listResponse, basePath);
        setNotifications(Array.isArray(listPayload.notifications) ? listPayload.notifications : []);
      }
    } catch (error) {
      setNotificationError(error instanceof Error ? error.message : 'Unable to load notifications');
    } finally {
      setIsLoadingNotifications(false);
    }
  }, [announcementSessionToken, hasAnnouncementInbox, role]);

  useEffect(() => {
    if (!hasAnnouncementInbox) return;
    void fetchAnnouncements(false);
    const interval = window.setInterval(() => void fetchAnnouncements(false), 120_000);
    return () => window.clearInterval(interval);
  }, [fetchAnnouncements, hasAnnouncementInbox]);

  useEffect(() => {
    if (isPage) void fetchAnnouncements(true);
  }, [fetchAnnouncements, isPage]);

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

  if (role !== 'customer' && role !== 'vendor' && role !== 'worker') {
    return null;
  }

  const handleBellClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (onNavigate) {
      onNavigate(activeView === 'alerts' ? 'dashboard' : 'alerts');
      return;
    }
    toggleOpen();
  };

  const toggleOpen = () => {
    const nextOpen = !isOpen;
    setIsOpen(nextOpen);
    if (nextOpen) {
      if (alertCount > 0) setActiveTab('alerts');
      else setActiveTab('announcements');
      if (hasAnnouncementInbox) void fetchAnnouncements(true);
    }
  };

  const markNotificationRead = async (recipientId: string) => {
    if (!announcementSessionToken || !hasAnnouncementInbox) return;
    try {
      const basePath = role === 'worker'
        ? '/api/worker/announcements'
        : role === 'vendor' ? '/api/vendor/messages' : '/api/announcements';
      const response = await fetch(`${basePath}/${encodeURIComponent(recipientId)}/read`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${announcementSessionToken}` },
      });
      if (response.status === 401) {
        onSessionExpiredRef.current();
        return;
      }
      if (!response.ok) throw new Error(`Unable to mark notification as read (${response.status})`);
      await fetchAnnouncements(true);
    } catch (error) {
      setNotificationError(error instanceof Error ? error.message : 'Unable to update notification');
    }
  };

  const markAllNotificationsRead = async () => {
    if (!announcementSessionToken || !hasAnnouncementInbox) return;
    try {
      const basePath = role === 'worker'
        ? '/api/worker/announcements'
        : role === 'vendor' ? '/api/vendor/messages' : '/api/announcements';
      const response = await fetch(`${basePath}/read-all`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${announcementSessionToken}` },
      });
      if (response.status === 401) {
        onSessionExpiredRef.current();
        return;
      }
      if (!response.ok) throw new Error(`Unable to mark notifications as read (${response.status})`);
      await fetchAnnouncements(true);
    } catch (error) {
      setNotificationError(error instanceof Error ? error.message : 'Unable to update notifications');
    }
  };

  const handleActionEnterMilk = (shift?: 'AM' | 'PM', targetCustomerId?: string, targetDate?: string) => {
    setIsOpen(false);
    onEnterMilk(shift, targetCustomerId, targetDate);
  };

  // Prefer grouped entries, but recover rows from the flat list when a backend
  // returns empty or incomplete groups.
  const todayDate = data?.todayIST || data?.date;
  const yesterdayDate = todayDate
    ? new Date(new Date(`${todayDate}T00:00:00Z`).getTime() - 86_400_000).toISOString().slice(0, 10)
    : undefined;
  const entriesForGroup = (group: 'today' | 'yesterday' | 'older') => {
    if (!data) return [];
    const getGroup = (entry: MissingEntryItem) => {
      if (entry.group) return entry.group;
      if (entry.daysOverdue !== undefined) {
        return entry.daysOverdue <= 0 ? 'today' : entry.daysOverdue === 1 ? 'yesterday' : 'older';
      }
      if (entry.date && todayDate) {
        return entry.date === todayDate
          ? 'today'
          : entry.date === yesterdayDate
            ? 'yesterday'
            : entry.date < todayDate ? 'older' : undefined;
      }
      return undefined;
    };
    const grouped = data.groups?.[group] || [];
    const flat = data.entries.filter((entry) => getGroup(entry) === group);
    const seen = new Set<string>();
    return [...grouped, ...flat].filter((entry) => {
      const key = `${entry.customerId ?? 'self'}_${entry.date ?? ''}_${entry.shift}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };
  const todayEntries = entriesForGroup('today');
  const yesterdayEntries = entriesForGroup('yesterday');
  const olderEntries = entriesForGroup('older');

  const todayCount = data?.todayCount ?? todayEntries.length;
  const yesterdayCount = data?.yesterdayCount ?? yesterdayEntries.length;
  const olderCount = data?.olderCount ?? olderEntries.length;
  const totalMissingCount = data?.totalCount ?? data?.count ?? (todayCount + yesterdayCount + olderCount);

  return (
    <div className="relative" ref={dropdownRef}>
      {!isPage && (
        <button
          type="button"
          onClick={handleBellClick}
          className={`relative min-h-11 min-w-11 p-2.5 rounded-xl border transition-all duration-200 flex items-center justify-center cursor-pointer ${
            hasAlerts
              ? 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100 shadow-sm'
              : 'bg-white border-slate-200 text-slate-500 hover:text-slate-700 hover:bg-slate-50'
          }`}
          title={hasAlerts ? `${t('notificationsLabel')} (${count})` : t('notificationsLabel')}
          aria-label={t('notificationsLabel')}
          aria-expanded={isOpen}
        >
          <Bell size={19} className={hasAlerts ? 'animate-bounce' : ''} />
          {hasAlerts && (
            <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-[20px] px-1 rounded-full bg-red-600 text-white text-[11px] font-extrabold flex items-center justify-center shadow-md animate-pulse">
              {count}
            </span>
          )}
        </button>
      )}

      <AnimatePresence>
        {(isOpen || isPage) && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.96 }}
            className={isPage
              ? 'relative z-0 mx-auto flex min-h-[min(65dvh,38rem)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm'
              : 'fixed inset-x-2 top-16 bottom-20 z-[90] mx-auto flex max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-2xl sm:fixed sm:inset-auto sm:right-6 sm:top-16 sm:bottom-auto sm:max-h-[min(88dvh,44rem)] sm:w-[32rem]'}
          >
            {/* Header */}
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 bg-white p-3.5 sm:p-4">
              <div className="flex min-w-0 items-center gap-2">
                <Bell size={18} className={hasAlerts ? 'text-amber-600' : 'text-slate-400'} />
                <h4 className="notification-copy min-w-0 flex-1 font-bold text-sm sm:text-base text-slate-800">
                  {t('notificationsAndAlerts')}
                </h4>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {count > 0 && (
                  <span className="text-[11px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                    {count}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => {
                    if (isPage && onNavigate) onNavigate('dashboard');
                    else setIsOpen(false);
                  }}
                  aria-label={t('close')}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                >
                  <X size={17} />
                </button>
              </div>
            </div>

            {/* Sub-Tabs: Missing Entries vs Announcements */}
            {hasAnnouncementInbox && (
              <div className="flex shrink-0 gap-1.5 border-b border-slate-100 bg-slate-50/70 p-2 sm:px-3">
                <button
                  type="button"
                  onClick={() => setActiveTab('alerts')}
                  className={`notification-tab flex-1 min-w-0 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-xl text-xs font-bold transition-all ${
                    activeTab === 'alerts'
                      ? 'bg-amber-500 text-white shadow-sm'
                      : 'text-slate-600 hover:bg-slate-200/60'
                  }`}
                >
                  <AlertTriangle size={13} />
                  <span className="notification-copy min-w-0 break-words">{t('missingMilkEntriesLabel')}</span>
                  {alertCount > 0 && (
                    <span className={`shrink-0 px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                      activeTab === 'alerts' ? 'bg-white/25 text-white' : 'bg-red-100 text-red-700'
                    }`}>
                      {alertCount}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('announcements');
                    void fetchAnnouncements(true);
                  }}
                  className={`notification-tab flex-1 min-w-0 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-xl text-xs font-bold transition-all ${
                    activeTab === 'announcements'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-600 hover:bg-slate-200/60'
                  }`}
                >
                  <Bell size={13} />
                  <span className="notification-copy min-w-0 break-words">{t('announcements')}</span>
                  {announcementCount > 0 && (
                    <span className={`shrink-0 px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                      activeTab === 'announcements' ? 'bg-white/25 text-white' : 'bg-emerald-100 text-emerald-800'
                    }`}>
                      {announcementCount}
                    </span>
                  )}
                </button>
              </div>
            )}

            {/* TAB CONTENT */}
            <div className="notification-copy min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 sm:p-4 space-y-3">
              {/* ALERTS TAB: Full Alerting Dashboard */}
              {activeTab === 'alerts' && (
                <div className="space-y-3">
                  {/* Top Alert Banner */}
                  <div className="min-w-0 rounded-2xl border border-amber-300 bg-gradient-to-br from-amber-50 via-orange-50/70 to-amber-50 p-3.5 sm:p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 text-white flex items-center justify-center shrink-0 shadow-md shadow-amber-500/20 text-lg font-bold">
                        ⚠️
                      </div>
                      <div className="notification-copy min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="min-w-0 break-words font-display font-bold text-slate-900 text-sm sm:text-base leading-snug">
                            {t('historicalMissingAlerts')}
                          </h3>
                          {totalMissingCount > 0 && (
                            <span className="max-w-full break-words px-2 py-0.5 rounded-full bg-red-600 text-white text-[10px] font-black uppercase shadow-sm animate-pulse">
                              {t('totalMissingCount').replace('{count}', String(totalMissingCount))}
                            </span>
                          )}
                        </div>
                        <p className="notification-copy text-slate-600 text-[11px] sm:text-xs font-medium mt-0.5">
                          {t('historicalMissingSubtitle')}
                        </p>
                      </div>
                    </div>

                    {/* Summary count pills */}
                    {totalMissingCount > 0 && (
                      <div className="mt-3 pt-2.5 border-t border-amber-200/70 flex items-center gap-1.5 sm:gap-2 flex-wrap">
                        {todayCount > 0 && (
                          <span className="max-w-full break-words inline-flex items-center gap-1 rounded-lg bg-rose-100 border border-rose-200 px-2 py-0.5 text-[11px] font-bold text-rose-800">
                            <span className="h-2 w-2 rounded-full bg-rose-500" />
                            {t('today')}: {todayCount}
                          </span>
                        )}
                        {yesterdayCount > 0 && (
                          <span className="max-w-full break-words inline-flex items-center gap-1 rounded-lg bg-orange-100 border border-orange-200 px-2 py-0.5 text-[11px] font-bold text-orange-800">
                            <span className="h-2 w-2 rounded-full bg-orange-500" />
                            {t('yesterday')}: {yesterdayCount}
                          </span>
                        )}
                        {olderCount > 0 && (
                          <span className="max-w-full break-words inline-flex items-center gap-1 rounded-lg bg-slate-200/80 border border-slate-300 px-2 py-0.5 text-[11px] font-bold text-slate-700">
                            <Clock size={11} />
                            {t('olderMissingEntries')}: {olderCount}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Empty State */}
                  {totalMissingCount === 0 && (
                    <div className="py-8 text-center text-slate-400 space-y-2">
                      <CheckCircle2 size={36} className="mx-auto text-emerald-500 opacity-80" />
                      <p className="text-sm font-semibold text-slate-700">{t('allEntriesUpToDate')}</p>
                      <p className="text-xs text-slate-400">{t('noMissingEntriesAllSub')}</p>
                    </div>
                  )}

                  {/* Group 1: Today's Missing Entries */}
                  {todayCount > 0 && (
                    <AlertGroupCard
                      title={t('todaysMissingEntries')}
                      count={todayCount}
                      entries={todayEntries}
                      role={role}
                      onEnterMilk={handleActionEnterMilk}
                      defaultExpanded={true}
                      colorScheme="red"
                    />
                  )}

                  {/* Group 2: Yesterday's Missing Entries */}
                  {yesterdayCount > 0 && (
                    <AlertGroupCard
                      title={t('yesterdaysMissingEntries')}
                      count={yesterdayCount}
                      entries={yesterdayEntries}
                      role={role}
                      onEnterMilk={handleActionEnterMilk}
                      defaultExpanded={true}
                      colorScheme="orange"
                    />
                  )}

                  {/* Group 3: Older Missing Entries */}
                  {olderCount > 0 && (
                    <AlertGroupCard
                      title={t('olderMissingEntries')}
                      count={olderCount}
                      entries={olderEntries}
                      role={role}
                      onEnterMilk={handleActionEnterMilk}
                      defaultExpanded={olderCount <= 15}
                      colorScheme="slate"
                    />
                  )}
                </div>
              )}

              {/* ANNOUNCEMENTS TAB */}
              {activeTab === 'announcements' && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between pb-1">
                    <div className="flex gap-1">
                      {(['all', 'unread'] as const).map((filter) => (
                        <button
                          key={filter}
                          type="button"
                          onClick={() => setNotificationFilter(filter)}
                          className={`rounded-full px-3 py-1 text-xs font-bold capitalize ${
                            notificationFilter === filter ? 'bg-emerald-700 text-white' : 'text-slate-500 hover:bg-slate-100'
                          }`}
                        >
                          {filter === 'all' ? t('allFilter') : `${t('unreadFilter')}${unreadCount ? ` (${unreadCount})` : ''}`}
                        </button>
                      ))}
                    </div>
                    {unreadCount > 0 && (
                      <button
                        type="button"
                        onClick={() => void markAllNotificationsRead()}
                        className="text-[11px] font-bold text-emerald-700 hover:text-emerald-900"
                      >
                        {t('markAllRead')}
                      </button>
                    )}
                  </div>

                  {notificationError && (
                    <p role="alert" className="rounded-lg bg-rose-50 p-2 text-xs text-rose-700">{notificationError}</p>
                  )}

                  {visibleNotifications.map((item) => {
                    const isExpanded = expandedNotification === item.recipient_id;
                    return (
                      <article
                        key={item.recipient_id}
                        className={`rounded-xl border p-3 ${
                          item.in_app_read_status === 'unread'
                            ? 'border-emerald-200 bg-emerald-50/50'
                            : 'border-slate-200 bg-white'
                        }`}
                      >
                        <button
                          type="button"
                          className="w-full min-w-0 text-left"
                          onClick={() => {
                            setExpandedNotification(isExpanded ? null : item.recipient_id);
                            if (!isExpanded && item.in_app_read_status === 'unread') {
                              void markNotificationRead(item.recipient_id);
                            }
                          }}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="min-w-0 flex-1 break-words text-xs font-bold text-slate-900">{item.title}</p>
                            {item.in_app_read_status === 'unread' && (
                              <span className="shrink-0 rounded-full bg-emerald-700 px-2 py-0.5 text-[10px] font-bold text-white">{t('unreadFilter')}</span>
                            )}
                          </div>
                          {item.category && <p className="mt-1 text-[10px] font-semibold text-emerald-800">{getLocalizedAnnouncementCategory(item.category, t)}</p>}
                        </button>
                        {isExpanded && (
                          <div className="mt-2 border-t border-slate-200/80 pt-2">
                            <p className="whitespace-pre-wrap break-words text-xs leading-relaxed text-slate-700">{item.message}</p>
                            <p className="mt-2 text-[10px] text-slate-500">{lang === 'ta' ? 'அனுப்புநர்:' : 'From:'} {item.vendor_name || (lang === 'ta' ? 'உங்கள் பால் விற்பனையாளர்' : 'Your Milk Vendor')}</p>
                            <p className="mt-1 flex items-center gap-1 text-[10px] text-slate-500">
                              <Clock size={11} />
                              {new Date(item.created_at).toLocaleString(lang === 'ta' ? 'ta-IN' : 'en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                              {item.in_app_read_status === 'read' && (lang === 'ta' ? ' · படிக்கப்பட்டது' : ' · Read')}
                            </p>
                            {item.in_app_read_status === 'unread' && (
                              <button type="button" onClick={() => void markNotificationRead(item.recipient_id)} className="mt-2 text-[11px] font-bold text-emerald-700">
                                {t('markAsRead')}
                              </button>
                            )}
                          </div>
                        )}
                      </article>
                    );
                  })}

                  {isLoadingNotifications && notifications.length === 0 && (
                    <p className="py-5 text-center text-xs text-slate-400">{t('loadingNotifications')}</p>
                  )}

                  {!notificationError && !isLoadingNotifications && visibleNotifications.length === 0 && (
                    <div className="py-8 text-center text-slate-400 space-y-2">
                      <CheckCircle2 size={32} className="mx-auto text-emerald-500 opacity-80" />
                      <p className="text-sm font-semibold text-slate-700">
                        {notificationFilter === 'unread'
                          ? t('noUnreadAnnouncements')
                          : role === 'worker' ? t('noVendorMessagesYet')
                            : role === 'vendor' ? t('noAdminMessagesYet') : t('noAnnouncementsYet')}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Bottom Footer: Quick link to logistics/entries */}
            {(role === 'vendor' || role === 'customer') && (
              <div className="notification-footer p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                <span className="notification-copy min-w-0 flex-1 text-[11px] text-slate-500">
                  {totalMissingCount > 0
                    ? t('missingEntriesCount').replace('{count}', String(totalMissingCount))
                    : t('allEntriesUpToDate')}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    onEnterMilk();
                  }}
                  className="max-w-full whitespace-normal break-words text-right text-xs font-bold text-emerald-700 hover:text-emerald-800"
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
// 4. Dashboard Warning Card (Clean, does not show permanently on dashboard)
// ─────────────────────────────────────────────────────────────────────────────
export function DashboardMissingAlertCard() {
  // Permanently hidden on the dashboard as per user request:
  // "does not show permently in dashboard so while clicking the bell icon show that alerting"
  return null;
}

export const HistoricalAlertDashboard = DashboardMissingAlertCard;
