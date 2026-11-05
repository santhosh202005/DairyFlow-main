import { useCallback, useEffect, useState } from 'react';
import { BellRing, Loader2, Search, Send, Users } from 'lucide-react';
import { useTranslation } from '../i18n';

interface VendorRecipient {
  id: number;
  name: string;
  phone: string | null;
}

interface VendorMessageHistory {
  id: string;
  title: string;
  message: string;
  created_at: string;
  recipient_count: number;
  read_count: number;
  unread_count: number;
}

function requestId() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export default function VendorMessagesAdmin() {
  const { t, lang } = useTranslation();
  const [vendors, setVendors] = useState<VendorRecipient[]>([]);
  const [history, setHistory] = useState<VendorMessageHistory[]>([]);
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [vendorCount, setVendorCount] = useState(0);
  const [sendToAll, setSendToAll] = useState(false);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [loadingVendors, setLoadingVendors] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const request = useCallback(async (url: string, init?: RequestInit) => {
    const response = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${localStorage.getItem('dairy_auth_token') || ''}`,
        ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
        ...init?.headers,
      },
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload?.message || `Request failed (${response.status})`);
    return payload;
  }, []);

  const loadVendors = useCallback(async () => {
    setLoadingVendors(true);
    setError('');
    try {
      const query = new URLSearchParams();
      if (search.trim()) query.set('search', search.trim());
      const suffix = query.toString() ? `?${query.toString()}` : '';
      const payload = await request(`/api/admin/vendor-message-recipients${suffix}`);
      if (!Array.isArray(payload.vendors)) throw new Error('The server returned an invalid vendor list.');
      setVendors(payload.vendors);
      setVendorCount(Number(payload.vendorCount) || 0);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load vendors');
      setVendors([]);
      setVendorCount(0);
    } finally {
      setLoadingVendors(false);
    }
  }, [request, search]);

  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const payload = await request('/api/admin/vendor-messages');
      setHistory(Array.isArray(payload.messages) ? payload.messages : []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load sent messages');
    } finally {
      setLoadingHistory(false);
    }
  }, [request]);

  useEffect(() => {
    void loadVendors();
  }, [loadVendors]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  const toggleVendor = (id: number) => {
    setSendToAll(false);
    setSelectedIds((current) => current.includes(id)
      ? current.filter((vendorId) => vendorId !== id)
      : [...current, id]);
  };

  const canSend = title.trim().length > 0 && title.length <= 120 &&
    message.trim().length > 0 && message.length <= 1800 &&
    ((sendToAll && vendorCount > 0) || selectedIds.length > 0);

  const sendMessage = async () => {
    if (!canSend || sending) return;
    const recipientCount = sendToAll ? vendorCount : selectedIds.length;
    const recipientLabel = sendToAll
      ? t('allVendors')
      : t('selectedVendors').replace('{count}', String(recipientCount));
    if (!window.confirm(t('confirmSendVendorMessage').replace('{title}', title.trim()).replace('{recipients}', recipientLabel))) return;
    setSending(true);
    setError('');
    setNotice('');
    try {
      const result = await request('/api/admin/vendor-messages', {
        method: 'POST',
        body: JSON.stringify({
          title: title.trim(),
          message: message.trim(),
          vendorIds: selectedIds,
          sendToAll,
          idempotencyKey: requestId(),
        }),
      });
      setNotice(t('messageSentToVendors').replace('{count}', String(result.recipientCount)));
      setTitle('');
      setMessage('');
      setSelectedIds([]);
      setSendToAll(false);
      await loadHistory();
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : 'Unable to send vendor message');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-5 pb-6">
      <header className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
          <BellRing size={22} />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-900">{t('vendorMessagePageTitle')}</h2>
          <p className="mt-1 text-sm text-slate-500">{t('vendorMessagePageDescription')}</p>
        </div>
      </header>

      {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</div>}
      {notice && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</div>}

      <section className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div>
            <label htmlFor="vendor-message-title" className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">{t('announcementTitle')}</label>
            <input
              id="vendor-message-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={120}
              placeholder={t('vendorMessageTitlePlaceholder')}
              className="min-h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-emerald-500"
            />
          </div>
          <div>
            <label htmlFor="vendor-message-body" className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">{t('announcementMessage')}</label>
            <textarea
              id="vendor-message-body"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              maxLength={1800}
              rows={6}
              placeholder={t('vendorMessageBodyPlaceholder')}
              className="w-full resize-y rounded-xl border border-slate-200 px-3 py-2.5 text-sm leading-relaxed outline-none focus:border-emerald-500"
            />
            <p className="mt-1 text-right text-[11px] text-slate-400">{message.length}/1800</p>
          </div>
          <button
            type="button"
            onClick={() => void sendMessage()}
            disabled={!canSend || sending}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 text-sm font-bold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            {sending ? t('sending') : t('sendVendorNotification')}
          </button>
        </div>

        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="font-bold text-slate-900">{t('recipients')}</h3>
              <p className="text-xs text-slate-500">{`${sendToAll ? vendorCount : selectedIds.length} ${t('selected')}`}</p>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
              <Users size={13} /> {vendorCount} {t('vendorsNav').toLowerCase()}
            </span>
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
            {t('sendToAllVendors')}
          </label>
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              aria-label={t('searchVendorsByName')}
              placeholder={t('searchVendorsByName')}
              className="min-h-11 w-full rounded-xl border border-slate-200 pl-9 pr-3 text-sm outline-none focus:border-emerald-500"
            />
          </div>
          <div className="max-h-60 space-y-1 overflow-y-auto overscroll-contain sm:max-h-72">
            {loadingVendors ? (
              <div className="py-8 text-center text-sm text-slate-400">{t('loadingVendors')}</div>
            ) : vendors.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-400">{t('noVendorsFound')}</p>
            ) : vendors.map((vendor) => (
              <label key={vendor.id} className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-xl px-2.5 py-2 hover:bg-slate-50 ${sendToAll ? 'opacity-50' : ''}`}>
                <input
                  type="checkbox"
                  checked={sendToAll || selectedIds.includes(vendor.id)}
                  disabled={sendToAll}
                  onChange={() => toggleVendor(vendor.id)}
                  className="h-4 w-4 shrink-0 accent-emerald-700"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-slate-800">{vendor.name}</span>
                  <span className="block truncate text-[11px] text-slate-400 sm:hidden">{vendor.phone || t('noPhone')}</span>
                </span>
                <span className="hidden text-xs text-slate-400 sm:inline">{vendor.phone || t('noPhone')}</span>
              </label>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <h3 className="mb-4 font-bold text-slate-900">{t('vendorMessageHistory')}</h3>
        {loadingHistory && history.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400">{t('loadingSentMessages')}</p>
        ) : history.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400">{t('noVendorMessagesSent')}</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {history.map((item) => (
              <article key={item.id} className="py-4 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-bold text-slate-900">{item.title}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{new Date(item.created_at).toLocaleString(lang === 'ta' ? 'ta-IN' : 'en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                    {t('vendorsReadCount').replace('{recipients}', String(item.recipient_count)).replace('{read}', String(item.read_count))}
                  </span>
                </div>
                <p className="mt-2 whitespace-pre-wrap break-words text-sm text-slate-600">{item.message}</p>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
