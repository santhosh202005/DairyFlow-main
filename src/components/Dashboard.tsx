import { useState, useEffect } from 'react';
import { Users, Milk, TrendingUp, AlertCircle, Package, Wallet } from 'lucide-react';
import { useTranslation } from '../i18n';
import { Stats, MissingEntriesResponse } from '../types';
import { loadStoredAuth } from '../auth';
import { apiFetch } from '../api';
import { DashboardMissingAlertCard } from './MissingEntriesAlert';

interface DashboardProps {
  customerId?: string;
  vendorId?: string;
  workerId?: string;
  onNavigate?: (view: any) => void;
  missingData?: MissingEntriesResponse | null;
  onEnterMilk?: (shift?: 'AM' | 'PM', customerId?: string) => void;
}

export default function Dashboard({ customerId, vendorId, workerId, onNavigate, missingData, onEnterMilk }: DashboardProps) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [retryCount, setRetryCount] = useState(0);
  const { t, lang } = useTranslation();

  useEffect(() => {
    const storedAuth = loadStoredAuth();
    console.log('[Dashboard] Authentication check:', {
      tokenPresent: Boolean(storedAuth?.token),
      role: storedAuth?.role,
      vendorId: storedAuth?.vendorId,
      vendorName: storedAuth?.vendorName,
    });

    if (!storedAuth?.token) {
      console.warn('[Dashboard] Missing authentication session while loading dashboard.');
      setIsLoading(false);
      setError('sessionRestoreError');
      return;
    }

    let isActive = true;
    let url = '/api/stats';
    if (customerId) url = `/api/stats?customerId=${customerId}`;
    else if (vendorId) url = `/api/stats?vendorId=${vendorId}`;
    else if (workerId) url = `/api/stats?workerId=${workerId}`;
    setIsLoading(true);
    setError('');
    apiFetch<Stats>(url, { headers: { Authorization: `Bearer ${storedAuth.token}` } }, { retries: 3, delayMs: 1000 })
      .then(data => {
        if (!isActive) return;
        console.log('[Dashboard] Stats loaded successfully.');
        setStats(data);
        setIsLoading(false);
      })
      .catch(err => {
        if (!isActive) return;
        console.error('[Dashboard] Stats load failed:', err);
        setIsLoading(false);
        setError('dashboardLoadError');
      });

    return () => {
      isActive = false;
    };
  }, [customerId, vendorId, workerId, retryCount]);

  if (error) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-6">
        <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-soft">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
            <AlertCircle size={24} />
          </div>
          <h2 className="font-display text-xl font-bold text-slate-900">{t('dashboardUnavailable')}</h2>
          <p className="mt-2 text-sm text-slate-500">{t(error)}</p>
          <button
            type="button"
            onClick={() => setRetryCount((count) => count + 1)}
            className="mt-6 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-emerald-700"
          >
            {t('retry')}
          </button>
        </div>
      </div>
    );
  }

  if (isLoading || !stats) {
    return (
      <div className="space-y-6 md:space-y-12" aria-busy="true" aria-live="polite">
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-soft">
          <img
            src="/new%20dairy%20flow.png"
            alt="DairyFlow"
            className="h-10 w-12 object-contain"
          />
          <span
            aria-hidden="true"
            className="h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-emerald-100 border-t-emerald-600"
          />
          <p className="text-sm font-semibold text-slate-600">{t('loadingDashboard')}</p>
        </div>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 md:gap-6">
          <div className="space-y-3">
            <div className="w-28 h-5 rounded-full bg-slate-200 animate-pulse" />
            <div className="w-64 h-10 rounded-2xl bg-slate-200 animate-pulse" />
            <div className="w-80 h-4 rounded bg-slate-100 animate-pulse" />
          </div>
          <div className="w-44 h-14 rounded-2xl bg-slate-100 animate-pulse" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-8">
          {Array.from({ length: workerId ? 1 : customerId ? 4 : 5 }).map((_, i) => (
            <div key={i} className="bento-card bg-white border border-slate-100 p-6 rounded-3xl space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 animate-pulse" />
              <div className="w-20 h-3 rounded bg-slate-100 animate-pulse" />
              <div className="w-32 h-8 rounded-xl bg-slate-200 animate-pulse" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-10">
          <div className="lg:col-span-2 bento-card space-y-5">
            <div className="h-6 w-40 rounded bg-slate-200 animate-pulse" />
            <div className="h-40 rounded-2xl bg-slate-100 animate-pulse" />
          </div>
          {!customerId && !workerId && (
            <div className="bento-card space-y-4">
              <div className="h-6 w-32 rounded bg-slate-200 animate-pulse" />
              <div className="h-16 rounded-xl bg-slate-100 animate-pulse" />
              <div className="h-16 rounded-xl bg-slate-100 animate-pulse" />
            </div>
          )}
        </div>
      </div>
    );
  }
  const formatLiters = (liters: number) => Number(liters || 0).toFixed(1);
  const formatRupees = (amount: number | undefined) =>
    `₹${new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount || 0)}`;

  const statCards = workerId ? [
    {
      label: t('milkCollectedToday'),
      value: `${formatLiters(stats.todaySupply)} L`,
      icon: Milk,
      color: 'bg-emerald-500',
      subtext: `AM: ${formatLiters(stats.todayAM)}L | PM: ${formatLiters(stats.todayPM)}L`
    }
  ] : [
    ...(customerId ? [] : [{ label: t('totalCustomers'), value: stats.totalCustomers, icon: Users, color: 'bg-blue-500' }]),
    { 
      label: t('todaysSupply'), 
      value: `${formatLiters(stats.todaySupply)} L`,
      icon: Milk, 
      color: 'bg-emerald-500',
      subtext: `AM: ${formatLiters(stats.todayAM)}L | PM: ${formatLiters(stats.todayPM)}L`
    },
    { label: t('feedCharges'), value: formatRupees(stats.monthlyFeed), icon: Package, color: 'bg-orange-500' },
    { label: t('monthlyRevenue'), value: formatRupees(stats.monthlyRevenue), icon: TrendingUp, color: 'bg-violet-500' },
    { label: t('pendingPayments'), value: formatRupees(stats.pendingPayments), icon: AlertCircle, color: 'bg-amber-500' },
  ];

  return (
    <div className="space-y-6 md:space-y-12">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 md:gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2 md:mb-3">
            <span className="px-3 py-1 bg-emerald-100 text-emerald-700 text-[10px] font-black rounded-full uppercase tracking-[0.15em]">
              {workerId ? t('workerDashboard') : customerId ? t('monitor') : t('administratorControl')}
            </span>
          </div>
          <h2 className="text-3xl md:text-5xl font-display font-bold text-slate-900 tracking-tight leading-none mb-2 md:mb-3">
            {t('pulseOverview') ? (
              <>{t('pulseOverview')}</>
            ) : (
              <>Pulse <span className="text-emerald-600">Overview</span></>
            )}
          </h2>
          <p className="text-slate-500 font-medium max-w-md text-sm md:text-base">
            {workerId ? t('workerDashboardDescription') : customerId ? t('customerDashboardDescription') : t('administratorControl')}
          </p>
        </div>
        <div className="bg-white px-4 py-2 md:px-6 md:py-3 rounded-[1.2rem] border border-slate-100 shadow-soft">
            <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mb-0.5 md:mb-1">{t('observationDate')}</p>
          <p className="text-sm font-black text-slate-900">{new Date().toLocaleDateString(lang === 'ta' ? 'ta-IN' : 'en-IN', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
        </div>
      </div>

      {/* Missing Milk Entry Warning Card */}
      <DashboardMissingAlertCard
        data={missingData || null}
        role={customerId ? 'customer' : vendorId ? 'vendor' : null}
        onEnterMilk={onEnterMilk || ((shift, cId) => onNavigate?.('entries'))}
      />

      <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-8">
        {statCards.map((stat, i) => (
          <div key={i} className="bento-card relative overflow-hidden group">
            <div className="relative z-10 flex flex-col gap-3 md:gap-6">
              <div className={`${stat.color} w-10 h-10 md:w-12 md:h-12 rounded-[1rem] text-white flex items-center justify-center shadow-lg transition-transform group-hover:scale-110 group-hover:rotate-3`}>
                <stat.icon size={18} className="md:hidden" />
                <stat.icon size={22} className="hidden md:block" />
              </div>
              <div>
                <p className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">{stat.label}</p>
                <p className="text-xl md:text-3xl font-display font-bold text-slate-900 tracking-tight">{stat.value}</p>
              </div>
              {stat.subtext && (
                <div className="pt-2 md:pt-4 border-t border-slate-50 flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <p className="text-[9px] md:text-[10px] font-bold text-slate-400 uppercase tracking-wider">{stat.subtext}</p>
                </div>
              )}
            </div>
            <div className="absolute top-0 right-0 -mr-4 -mt-4 w-24 h-24 bg-slate-50 rounded-full opacity-50 group-hover:scale-150 transition-transform duration-700" />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-10">
        <div className="lg:col-span-2 bento-card border-slate-200/50 bg-white/40 backdrop-blur-sm">
          <div className="flex items-center justify-between mb-6 md:mb-10">
            <h3 className="text-lg md:text-xl font-display font-bold text-slate-900 tracking-tight">{t('recentActivity')}</h3>
            <div className="px-3 py-1 rounded-full bg-slate-100 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
              {t('liveFeed')}
            </div>
          </div>
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center text-slate-300">
              <TrendingUp size={32} />
            </div>
            <div>
              <p className="font-bold text-slate-400 text-sm">{t('systemQuiescent')}</p>
              <p className="text-xs text-slate-300 font-medium">{t('historicalLogsComingSoon')}</p>
            </div>
          </div>
        </div>
        
        {!customerId && !workerId && (
          <div className="bento-card border-emerald-100 bg-emerald-50/20">
            <h3 className="text-xl font-display font-bold text-slate-900 tracking-tight mb-8">{t('operations')}</h3>
            <div className="grid grid-cols-1 gap-4">
              <button 
                onClick={() => onNavigate?.('entries')}
                className="flex items-center gap-4 p-5 rounded-2xl bg-white border border-slate-100 shadow-soft hover:shadow-medium hover:scale-[1.02] transition-all group text-left"
              >
                <div className="w-12 h-12 rounded-[1rem] bg-emerald-600 text-white flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                  <Milk size={20} />
                </div>
                <div>
                  <p className="font-bold text-slate-900 text-sm">{t('recordMilk')}</p>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{t('logDailySupply')}</p>
                </div>
              </button>

              <button 
                onClick={() => onNavigate?.('customers')}
                className="flex items-center gap-4 p-5 rounded-2xl bg-white border border-slate-100 shadow-soft hover:shadow-medium hover:scale-[1.02] transition-all group text-left"
              >
                <div className="w-12 h-12 rounded-[1rem] bg-blue-600 text-white flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                  <Users size={20} />
                </div>
                <div>
                  <p className="font-bold text-slate-900 text-sm">{t('onboardFarmer')}</p>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{t('registerNewAccount')}</p>
                </div>
              </button>

              <button 
                onClick={() => onNavigate?.('advances')}
                className="flex items-center gap-4 p-5 rounded-2xl bg-white border border-slate-100 shadow-soft hover:shadow-medium hover:scale-[1.02] transition-all group text-left"
              >
                <div className="w-12 h-12 rounded-[1rem] bg-violet-600 text-white flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                  <Wallet size={20} />
                </div>
                <div>
                  <p className="font-bold text-slate-900 text-sm">{t('distributeFunds')}</p>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{t('manageAdvances')}</p>
                </div>
              </button>

              <button 
                onClick={() => onNavigate?.('feed')}
                className="flex items-center gap-4 p-5 rounded-2xl bg-white border border-slate-100 shadow-soft hover:shadow-medium hover:scale-[1.02] transition-all group text-left"
              >
                <div className="w-12 h-12 rounded-[1rem] bg-orange-600 text-white flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                  <Package size={20} />
                </div>
                <div>
                  <p className="font-bold text-slate-900 text-sm">{t('cattleResource')}</p>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{t('logFeedInventory')}</p>
                </div>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
