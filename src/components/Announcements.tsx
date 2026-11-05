import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  BellRing, Check, CheckCircle2, Clock3, Loader2, Megaphone, Search,
  Send, Users, X, XCircle,
} from 'lucide-react';
import { useTranslation } from '../i18n';

const CATEGORIES = [
  'Milk Delivery Update',
  'Delivery Delay',
  'Holiday Notice',
  'Milk Rate Change',
  'Monthly Bill Reminder',
  'General Announcement',
] as const;

type AnnouncementCategory = typeof CATEGORIES[number];

interface AnnouncementRecipient {
  id: number;
  name: string;
  phone: string | null;
}

interface AnnouncementHistoryItem {
  id: string;
  title: string;
  message: string;
  category: AnnouncementCategory;
  created_at: string;
  recipient_type: 'customer' | 'worker';
  recipient_count: number;
  sms_submitted: number;
  sms_delivered: number;
  sms_failed: number;
  sms_unknown: number;
  sms_pending: number;
}

interface AnnouncementsProps {
  sessionToken: string;
  onSessionExpired: () => void;
}

function createRequestId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

export default function Announcements({ sessionToken, onSessionExpired }: AnnouncementsProps) {
  const { t, lang } = useTranslation();
  const [customers, setCustomers] = useState<AnnouncementRecipient[]>([]);
  const [recipientType, setRecipientType] = useState<'customer' | 'worker'>('customer');
  const [history, setHistory] = useState<AnnouncementHistoryItem[]>([]);
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [assignedCount, setAssignedCount] = useState(0);
  const [sendToAll, setSendToAll] = useState(false);
  const [category, setCategory] = useState<AnnouncementCategory>(CATEGORIES[0]);
  const [title, setTitle] = useState<string>(CATEGORIES[0]);
  const [message, setMessage] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingCustomers, setLoadingCustomers] = useState(true);
  const [recipientsError, setRecipientsError] = useState('');
  const [sending, setSending] = useState(false);
  const [retryingAnnouncementId, setRetryingAnnouncementId] = useState<string | null>(null);
  const [smsConfigured, setSmsConfigured] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [requestId, setRequestId] = useState(createRequestId);
  const onSessionExpiredRef = useRef(onSessionExpired);
  const recipientsRequestId = useRef(0);

  useEffect(() => {
    onSessionExpiredRef.current = onSessionExpired;
  }, [onSessionExpired]);

  const request = useCallback(async (url: string, init?: RequestInit) => {
    const response = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${sessionToken}`,
        ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
        ...init?.headers,
      },
    });
    const responseText = await response.text();
    const contentType = response.headers.get('content-type') || '';
    let payload: any = {};
    if (contentType.includes('application/json')) {
      try {
        payload = JSON.parse(responseText);
      } catch {
        throw new Error('The announcement API returned invalid JSON. Check the backend deployment and try again.');
      }
    } else if (response.ok) {
      throw new Error(
        `The announcement API route ${url} is missing from the deployed backend. ` +
        'Render returned the app page instead of API data; deploy the latest server.ts backend.',
      );
    }
    if (response.status === 401) {
      onSessionExpiredRef.current();
      throw new Error('Your session expired. Please sign in again.');
    }
    if (!response.ok) throw new Error(payload?.message || `Request failed (${response.status})`);
    return payload;
  }, [sessionToken]);

  const loadPageData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const historyPayload = await request('/api/vendor/announcements');
      setHistory(Array.isArray(historyPayload.announcements) ? historyPayload.announcements : []);
      setSmsConfigured(Boolean(historyPayload.smsConfigured));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load announcements');
    } finally {
      setLoading(false);
    }
  }, [request]);

  const loadCustomers = useCallback(async (term: string) => {
    const currentRequestId = ++recipientsRequestId.current;
    setLoadingCustomers(true);
    setRecipientsError('');
    try {
      const query = new URLSearchParams();
      if (term.trim()) query.set('search', term.trim());
      const queryString = query.toString();
      const suffix = queryString ? `?${queryString}` : '';
      const payload = await request(`/api/vendor/announcement-${recipientType === 'worker' ? 'workers' : 'recipients'}${suffix}`);
      const recipients = recipientType === 'worker' ? payload.workers : payload.customers;
      const count = recipientType === 'worker' ? payload.workerCount : payload.customerCount;
      if (!Array.isArray(recipients)) {
        throw new Error(`The server returned an invalid ${recipientType === 'worker' ? 'worker' : 'customer'} list.`);
      }
      if (currentRequestId !== recipientsRequestId.current) return;
      setCustomers(Array.isArray(recipients) ? recipients : []);
      setAssignedCount(Number(count) || 0);
    } catch (loadError) {
      if (currentRequestId !== recipientsRequestId.current) return;
      const message = loadError instanceof Error ? loadError.message : `Unable to load ${recipientType === 'worker' ? 'workers' : 'customers'}`;
      setRecipientsError(
        recipientType === 'worker' && message.includes('(404)')
          ? 'Worker announcements are not available on the current backend yet. Deploy the latest backend, then refresh this list.'
          : message,
      );
      setCustomers([]);
      setAssignedCount(0);
    } finally {
      if (currentRequestId === recipientsRequestId.current) setLoadingCustomers(false);
    }
  }, [recipientType, request]);

  useEffect(() => {
    void loadPageData();
  }, [loadPageData]);

  useEffect(() => {
    void loadCustomers(search);
  }, [loadCustomers, search]);

  const toggleCustomer = (customerId: number) => {
    setSendToAll(false);
    setSelectedIds((current) => current.includes(customerId)
      ? current.filter((id) => id !== customerId)
      : [...current, customerId]);
  };

  const handleCategoryChange = (nextCategory: AnnouncementCategory) => {
    setCategory(nextCategory);
    if (!title.trim() || CATEGORIES.includes(title as AnnouncementCategory)) setTitle(nextCategory);
  };

  const handleSend = async () => {
    setSending(true);
    setError('');
    setNotice('');
    try {
      const result = await request('/api/vendor/announcements', {
        method: 'POST',
        body: JSON.stringify({
          title: title.trim(),
          message: message.trim(),
          category,
          recipientType,
          ...(recipientType === 'worker' ? { workerIds: selectedIds } : { customerIds: selectedIds }),
          sendToAll,
          idempotencyKey: requestId,
        }),
      });
      setConfirming(false);
      const count = String(result.recipientCount ?? recipientsCount);
      const recipient = recipientType === 'worker' ? t('recipientWorker') : t('recipientCustomer');
      setNotice(`${t('announcementSaved').replace('{count}', count).replace('{recipient}', recipient)} ${
        result.smsConfigured ? t('smsSubmissionProcessing') : t('inAppSmsPending')
      }`);
      setTitle(category);
      setMessage('');
      setSelectedIds([]);
      setSendToAll(false);
      setRequestId(createRequestId());
      await loadPageData();
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : 'Unable to send announcement');
    } finally {
      setSending(false);
    }
  };

  const handleRetryPendingSms = async (announcementId: string) => {
    setRetryingAnnouncementId(announcementId);
    setError('');
    try {
      const result = await request(`/api/vendor/announcements/${encodeURIComponent(announcementId)}/send-sms`, {
        method: 'POST',
      });
      setNotice(`${t('smsSubmissionProcessing')} (${result.queuedCount})`);
      await loadPageData();
    } catch (retryError) {
      setError(retryError instanceof Error ? retryError.message : 'Unable to submit pending SMS');
    } finally {
      setRetryingAnnouncementId(null);
    }
  };

  const recipientsCount = sendToAll ? assignedCount : selectedIds.length;
  const canReview = title.trim().length > 0 &&
    message.trim().length > 0 &&
    message.length <= 1800 &&
    ((sendToAll && assignedCount > 0) || selectedIds.length > 0);

  return (
    <div className="mx-auto max-w-5xl space-y-5 pb-6">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
          <Megaphone size={22} />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-900">{t('sendAnnouncement')}</h2>
          <p className="mt-1 text-sm text-slate-500">{t('announcementSubtitle')}</p>
        </div>
      </div>

      {!smsConfigured && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <BellRing size={17} className="mt-0.5 shrink-0" />
          <p>{t('announcementSmsDisabled')}</p>
        </div>
      )}
      {error && (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</div>
      )}
      {notice && (
        <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</div>
      )}

      <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.9fr)]">
        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div>
            <label htmlFor="announcement-category" className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">{t('announcementCategory')}</label>
            <select
              id="announcement-category"
              value={category}
              onChange={(event) => handleCategoryChange(event.target.value as AnnouncementCategory)}
              className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            >
              {CATEGORIES.map((item) => <option key={item} value={item}>{t(categoryTranslationKey(item))}</option>)}
            </select>
          </div>

          <div>
            <label htmlFor="announcement-title" className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">{t('announcementTitle')}</label>
            <input
              id="announcement-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={120}
              className="min-h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              placeholder={t('announcementTitle')}
            />
          </div>

          <div>
            <label htmlFor="announcement-message" className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">{t('announcementMessage')}</label>
            <textarea
              id="announcement-message"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              maxLength={1800}
              rows={5}
              className="w-full resize-y rounded-xl border border-slate-200 px-3 py-2.5 text-sm leading-relaxed outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              placeholder={t('announcementMessagePlaceholder')}
            />
            <p className="mt-1 text-right text-[11px] text-slate-400">{message.length}/1800</p>
          </div>

          <div className="flex flex-col gap-2 border-t border-slate-100 pt-4 sm:flex-row">
            <button
              type="button"
              onClick={() => setConfirming(true)}
              disabled={!canReview || loading || sending}
              className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 text-sm font-bold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Send size={16} /> {t('reviewAndSend')}
            </button>
            <button
              type="button"
              onClick={() => {
                setTitle(category);
                setMessage('');
                setNotice('');
                setError('');
              }}
              className="min-h-11 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-600 hover:bg-slate-50"
            >
              {t('clear')}
            </button>
          </div>
        </div>

        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="font-bold text-slate-900">{t('recipients')}</h3>
              <p className="text-xs text-slate-500">{`${sendToAll ? assignedCount : selectedIds.length} ${t('selected')}`}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                <Users size={13} /> {assignedCount} {t('assigned')}
              </span>
              <button
                type="button"
                onClick={() => void loadCustomers(search)}
                disabled={loadingCustomers}
                className="min-h-9 rounded-lg border border-slate-200 px-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                {t('refresh')}
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 rounded-xl bg-slate-100 p-1">
            {(['customer', 'worker'] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => {
                  setRecipientType(type);
                  setSelectedIds([]);
                  setSendToAll(false);
                  setSearch('');
                  setCustomers([]);
                  setAssignedCount(0);
                  setRecipientsError('');
                }}
                className={`min-h-10 rounded-lg text-sm font-bold capitalize ${recipientType === type ? 'bg-white text-emerald-800 shadow-sm' : 'text-slate-500'}`}
              >
                {type === 'customer' ? t('customers') : t('workersRecipients')}
              </button>
            ))}
          </div>
          <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 text-sm font-semibold text-emerald-900">
            <input
              type="checkbox"
              checked={sendToAll}
              onChange={(event) => {
                setSendToAll(event.target.checked);
                setSelectedIds([]);
              }}
              className="h-4 w-4 accent-emerald-700"
            />
            {recipientType === 'worker' ? t('sendToAllAssignedWorkers') : t('sendToAllAssignedCustomers')}
          </label>
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              aria-label={recipientType === 'worker' ? t('searchWorkersByName') : t('searchCustomersByName')}
              placeholder={recipientType === 'worker' ? t('searchWorkersByName') : t('searchCustomersByName')}
              className="min-h-11 w-full rounded-xl border border-slate-200 pl-9 pr-3 text-sm outline-none focus:border-emerald-500"
            />
          </div>
          {recipientsError && (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800" role="alert">
              <span>{recipientsError}</span>
              <button type="button" onClick={() => void loadCustomers(search)} className="shrink-0 font-bold underline">
                {t('retry')}
              </button>
            </div>
          )}
          <div className="max-h-60 space-y-1 overflow-y-auto overscroll-contain sm:max-h-72">
            {loadingCustomers ? (
              <div className="flex items-center justify-center gap-2 py-8 text-sm text-slate-400"><Loader2 size={16} className="animate-spin" /> {recipientType === 'worker' ? t('loadingWorkers') : t('loadingCustomers')}</div>
            ) : recipientsError ? null : customers.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-400">{recipientType === 'worker' ? t('noAssignedWorkers') : t('noAssignedCustomers')}</p>
            ) : customers.map((customer) => (
              <label key={customer.id} className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-xl px-2.5 py-2 hover:bg-slate-50 ${sendToAll ? 'opacity-50' : ''}`}>
                <input
                  type="checkbox"
                  checked={sendToAll || selectedIds.includes(customer.id)}
                  disabled={sendToAll}
                  onChange={() => toggleCustomer(customer.id)}
                  className="h-4 w-4 shrink-0 accent-emerald-700"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-slate-800">{customer.name}</span>
                  <span className="block truncate text-[11px] text-slate-400 sm:hidden">{customer.phone || t('noPhone')}</span>
                </span>
                <span className="hidden text-xs text-slate-400 sm:inline">{customer.phone || t('noPhone')}</span>
              </label>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-900">{t('previousAnnouncements')}</h3>
            <p className="text-xs text-slate-500">{t('smsAcceptanceNotDelivery')}</p>
          </div>
          <button type="button" onClick={() => void loadPageData()} disabled={loading} className="rounded-lg px-3 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-50">{t('refresh')}</button>
        </div>
        {loading && history.length === 0 ? (
          <div className="py-8 text-center text-sm text-slate-400">{t('loadingHistory')}</div>
        ) : history.length === 0 ? (
          <div className="py-8 text-center text-sm text-slate-400">{t('noAnnouncementsSent')}</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {history.map((item) => (
              <article key={item.id} className="py-4 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-bold text-slate-900">{item.title}</p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {t(categoryTranslationKey(item.category))} · {item.recipient_type === 'worker' ? t('toWorkers') : t('toCustomers')} · {new Date(item.created_at).toLocaleString(lang === 'ta' ? 'ta-IN' : 'en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                    </p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">{t('recipientsCount').replace('{count}', String(item.recipient_count))}</span>
                </div>
                <p className="mt-2 whitespace-pre-wrap break-words text-sm text-slate-600">{item.message}</p>
                <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
                  <StatusCount icon={<Clock3 size={12} />} label={t('smsPending')} count={item.sms_pending} />
                  <StatusCount icon={<CheckCircle2 size={12} />} label={t('smsSubmitted')} count={item.sms_submitted} />
                  {item.sms_delivered > 0 && <StatusCount icon={<Check size={12} />} label={t('smsDelivered')} count={item.sms_delivered} />}
                  <StatusCount icon={<XCircle size={12} />} label={t('smsFailed')} count={item.sms_failed} />
                  <StatusCount icon={<Clock3 size={12} />} label={t('smsUnknown')} count={item.sms_unknown} />
                </div>
                {smsConfigured && item.sms_pending > 0 && (
                  <button
                    type="button"
                    onClick={() => void handleRetryPendingSms(item.id)}
                    disabled={retryingAnnouncementId === item.id}
                    className="mt-2 inline-flex min-h-9 items-center gap-2 rounded-lg border border-emerald-200 px-3 text-xs font-bold text-emerald-800 hover:bg-emerald-50 disabled:opacity-50"
                  >
                    {retryingAnnouncementId === item.id && <Loader2 size={13} className="animate-spin" />}
                    {t('submitPendingSms')}
                  </button>
                )}
              </article>
            ))}
          </div>
        )}
      </section>

      {confirming && (
        createPortal(
        <div className="fixed inset-0 z-[300] flex items-end justify-center bg-slate-950/50 p-2 pb-[calc(5rem+env(safe-area-inset-bottom))] sm:items-center sm:p-4" role="presentation" onClick={() => !sending && setConfirming(false)}>
          <div role="dialog" aria-modal="true" aria-labelledby="confirm-announcement-title" className="flex max-h-[calc(100dvh-6rem-env(safe-area-inset-bottom))] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-white p-5 shadow-2xl sm:max-h-[calc(100dvh-2rem)] sm:rounded-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 id="confirm-announcement-title" className="font-bold text-slate-900">{t('confirmAnnouncement')}</h3>
                <p className="mt-1 text-sm text-slate-500">{t('announcementWillNotify').replace('{count}', String(recipientsCount)).replace('{recipient}', recipientType === 'worker' ? t('recipientWorker') : t('recipientCustomer'))}{smsConfigured ? (lang === 'ta' ? ' மேலும் SMS கோரிக்கை சமர்ப்பிக்கப்படும்.' : ' and submit an SMS request.') : ''}</p>
              </div>
              <button type="button" onClick={() => setConfirming(false)} aria-label={t('closeConfirmation')} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X size={18} /></button>
            </div>
            <div className="mt-4 min-h-0 flex-1 overflow-y-auto overscroll-contain rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-bold uppercase text-slate-500">{t(categoryTranslationKey(category))}</p>
              <p className="mt-1 font-bold text-slate-900">{title}</p>
              <p className="mt-2 whitespace-pre-wrap break-words text-sm text-slate-700">{message}</p>
            </div>
            <div className="mt-4 flex shrink-0 gap-2">
              <button type="button" onClick={() => setConfirming(false)} disabled={sending} className="min-h-11 flex-1 rounded-xl border border-slate-200 font-bold text-slate-600">{t('cancel')}</button>
              <button type="button" onClick={() => void handleSend()} disabled={sending} className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-700 font-bold text-white disabled:opacity-60">
                {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                {sending ? t('sending') : t('confirmAndSend')}
              </button>
            </div>
          </div>
        </div>, document.body)
      )}
    </div>
  );
}

function categoryTranslationKey(category: string) {
  const keys: Record<string, string> = {
    'Milk Delivery Update': 'milkDeliveryUpdate',
    'Delivery Delay': 'deliveryDelay',
    'Holiday Notice': 'holidayNotice',
    'Milk Rate Change': 'milkRateChange',
    'Monthly Bill Reminder': 'monthlyBillReminder',
    'General Announcement': 'generalAnnouncement',
  };
  return keys[category] || category;
}

function StatusCount({ icon, label, count }: { icon: React.ReactNode; label: string; count: number }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-1 text-slate-600">
      {icon}{label}: {count}
    </span>
  );
}
