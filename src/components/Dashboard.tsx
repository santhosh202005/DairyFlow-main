import { useState, useEffect, useMemo, useRef } from 'react';
import { Users, Milk, TrendingUp, AlertCircle, Package, Wallet, ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { useTranslation } from '../i18n';
import { Stats, MissingEntriesResponse } from '../types';
import { loadStoredAuth } from '../auth';
import { apiFetch } from '../api';

interface DashboardProps {
  customerId?: string;
  vendorId?: string;
  workerId?: string;
  onNavigate?: (view: any) => void;
  missingData?: MissingEntriesResponse | null;
  onEnterMilk?: (shift?: 'AM' | 'PM', customerId?: string, date?: string) => void;
}

type TrendRange = '7d' | '30d' | 'month';
type TrendView = 'total' | 'am' | 'pm' | 'shifts';

interface MilkTrendEntry {
  date: string;
  amLiters: number | null;
  pmLiters: number | null;
  totalLiters: number | null;
}

interface MilkTrendPoint extends MilkTrendEntry {
  label: string;
}

interface MilkEntryApiRecord {
  date?: string;
  shift?: string;
  liters?: number | string;
  customer_id?: string | number;
  worker_id?: string | number | null;
}

interface CustomerApiRecord {
  id?: string | number;
  vendor_id?: string | number | null;
}

function localDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getTrendDateRange(range: TrendRange, now = new Date()): { startDate: string; endDate: string } {
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let start: Date;
  if (range === 'month') {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
  } else {
    start = new Date(end);
    start.setDate(start.getDate() - (range === '7d' ? 6 : 29));
  }
  return { startDate: localDateKey(start), endDate: localDateKey(end) };
}

function formatTrendDate(date: string): string {
  const parsed = new Date(`${date}T12:00:00`);
  return parsed.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

async function loadMilkTrendsFromExistingEndpoints(
  startDate: string,
  endDate: string,
  customerId: string | undefined,
  vendorId: string | undefined,
  workerId: string | undefined,
  authToken: string
): Promise<MilkTrendEntry[]> {
  const params = new URLSearchParams();
  if (customerId) params.set('customerId', customerId);
  else if (vendorId) params.set('vendorId', vendorId);
  else if (workerId) params.set('workerId', workerId);

  let entries = await apiFetch<MilkEntryApiRecord[]>(
    `/api/entries${params.size ? `?${params.toString()}` : ''}`,
    { headers: { Authorization: `Bearer ${authToken}` } },
    { retries: 0 }
  );
  if (!Array.isArray(entries)) {
    throw new Error('Milk entries endpoint returned an invalid response.');
  }

  if (vendorId) {
    const customers = await apiFetch<CustomerApiRecord[]>(
      '/api/customers',
      { headers: { Authorization: `Bearer ${authToken}` } },
      { retries: 0 }
    );
    if (!Array.isArray(customers)) {
      throw new Error('Customer endpoint returned an invalid response.');
    }
    const vendorCustomerIds = new Set(
      customers
        .filter((customer) => String(customer.vendor_id ?? '') === vendorId)
        .map((customer) => String(customer.id ?? ''))
    );
    entries = entries.filter((entry) => vendorCustomerIds.has(String(entry.customer_id ?? '')));
  }
  if (workerId) {
    entries = entries.filter((entry) => String(entry.worker_id ?? '') === workerId);
  }

  const daily = new Map<string, {
    amLiters: number;
    pmLiters: number;
    totalLiters: number;
    amEntries: number;
    pmEntries: number;
  }>();
  entries.forEach((entry) => {
    const date = String(entry.date ?? '').slice(0, 10);
    if (date < startDate || date > endDate) return;
    const liters = Number(entry.liters);
    if (!Number.isFinite(liters) || (entry.shift !== 'AM' && entry.shift !== 'PM')) return;
    const totals = daily.get(date) || {
      amLiters: 0,
      pmLiters: 0,
      totalLiters: 0,
      amEntries: 0,
      pmEntries: 0,
    };
    if (entry.shift === 'AM') {
      totals.amLiters += liters;
      totals.amEntries += 1;
    } else {
      totals.pmLiters += liters;
      totals.pmEntries += 1;
    }
    totals.totalLiters += liters;
    daily.set(date, totals);
  });

  return [...daily.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([date, totals]) => ({
    date,
    amLiters: totals.amEntries > 0 ? totals.amLiters : null,
    pmLiters: totals.pmEntries > 0 ? totals.pmLiters : null,
    totalLiters: totals.amEntries + totals.pmEntries > 0 ? totals.totalLiters : null,
  }));
}

function MilkTrendChart({
  points,
  view,
  onSelect,
}: {
  points: MilkTrendPoint[];
  view: TrendView;
  onSelect: (index: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(360);
  const height = 220;
  const plot = { left: 38, right: 10, top: 12, bottom: 32 };
  const plotWidth = width - plot.left - plot.right;
  const plotHeight = height - plot.top - plot.bottom;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateWidth = () => {
      const measuredWidth = Math.floor(container.getBoundingClientRect().width);
      if (measuredWidth > 0) setWidth(measuredWidth);
    };
    updateWidth();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updateWidth);
      return () => window.removeEventListener('resize', updateWidth);
    }
    const observer = new ResizeObserver(updateWidth);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const values = points.flatMap((point) => {
    if (view === 'shifts') return [point.amLiters, point.pmLiters].filter((value): value is number => value !== null);
    const value = view === 'am' ? point.amLiters : view === 'pm' ? point.pmLiters : point.totalLiters;
    return value === null ? [] : [value];
  });
  const maxValue = Math.max(10, ...values);
  const step = maxValue <= 20 ? 5 : maxValue <= 50 ? 10 : Math.ceil(maxValue / 4 / 10) * 10;
  const yMaximum = Math.max(step, Math.ceil(maxValue / step) * step);
  const y = (value: number) => plot.top + plotHeight - (value / yMaximum) * plotHeight;
  const x = (index: number) => plot.left + (points.length <= 1 ? plotWidth / 2 : (index / (points.length - 1)) * plotWidth);
  const series = view === 'shifts'
    ? [
        { key: 'am' as const, color: '#059669', values: points.map((point) => point.amLiters) },
        { key: 'pm' as const, color: '#34d399', values: points.map((point) => point.pmLiters) },
      ]
    : [{
        key: view === 'am' ? 'am' as const : view === 'pm' ? 'pm' as const : 'total' as const,
        color: '#059669',
        values: points.map((point) => view === 'am' ? point.amLiters : view === 'pm' ? point.pmLiters : point.totalLiters),
      }];

  const linePath = (lineValues: Array<number | null>) => {
    const segments: string[] = [];
    let segment: Array<{ x: number; y: number }> = [];
    const flush = () => {
      if (segment.length === 1) {
        segments.push(`M ${segment[0].x} ${segment[0].y}`);
      } else if (segment.length > 1) {
        const path = [`M ${segment[0].x} ${segment[0].y}`];
        for (let i = 1; i < segment.length; i++) {
          const previous = segment[i - 1];
          const current = segment[i];
          const controlX = (previous.x + current.x) / 2;
          path.push(`C ${controlX} ${previous.y}, ${controlX} ${current.y}, ${current.x} ${current.y}`);
        }
        segments.push(path.join(' '));
      }
      segment = [];
    };
    lineValues.forEach((value, index) => {
      if (value === null) {
        flush();
      } else {
        segment.push({ x: x(index), y: y(value) });
      }
    });
    flush();
    return segments.join(' ');
  };

  const tickCount = 4;
  const dateLabelStep = Math.max(1, Math.ceil(points.length / Math.max(2, Math.floor(plotWidth / 52))));
  const selectedIndex = Math.max(0, points.length - 1);

  return (
    <div ref={containerRef} className="w-full min-w-0">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-1 pb-2 text-[10px] font-semibold text-slate-500">
        {series.map((line) => (
          <span key={line.key} className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: line.color }} />
            {line.key === 'total' ? 'Daily total' : line.key === 'am' ? 'AM' : 'PM'}
          </span>
        ))}
        <span className="ml-auto text-slate-400">Litres</span>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="block h-48 w-full max-w-full overflow-visible sm:h-52"
        role="img"
        aria-label="Daily milk quantity trend chart"
        onPointerDown={(event) => {
          if (points.length < 2) return;
          const bounds = event.currentTarget.getBoundingClientRect();
          const chartX = ((event.clientX - bounds.left) / bounds.width) * width;
          const nearestIndex = Math.round(((chartX - plot.left) / plotWidth) * (points.length - 1));
          onSelect(Math.max(0, Math.min(points.length - 1, nearestIndex)));
        }}
      >
        {Array.from({ length: tickCount + 1 }, (_, index) => {
          const value = (yMaximum / tickCount) * index;
          const tickY = y(value);
          return (
            <g key={index}>
              <line x1={plot.left} x2={width - plot.right} y1={tickY} y2={tickY} stroke="#e2e8f0" strokeDasharray="3 4" />
              <text x={plot.left - 8} y={tickY + 3} textAnchor="end" fill="#94a3b8" fontSize="10">{value.toFixed(0)}</text>
            </g>
          );
        })}
        {points.map((point, index) => {
          const slotWidth = plotWidth / Math.max(1, points.length);
          const slotCenter = x(index);
          return (
            <rect
              key={`hit-${point.date}`}
              x={Math.max(plot.left, slotCenter - slotWidth / 2)}
              y={plot.top}
              width={Math.min(slotWidth, width - plot.right - Math.max(plot.left, slotCenter - slotWidth / 2))}
              height={plotHeight}
              fill="transparent"
              tabIndex={0}
              role="button"
              aria-label={`${formatTrendDate(point.date)} milk entry details`}
              onPointerEnter={() => onSelect(index)}
              onFocus={() => onSelect(index)}
              onClick={() => onSelect(index)}
            />
          );
        })}
        {series.map((line) => (
          <g key={line.key}>
            <path d={linePath(line.values)} fill="none" stroke={line.color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            {line.values.map((value, index) => value === null ? null : (
              <circle
                key={`${line.key}-${points[index].date}`}
                cx={x(index)}
                cy={y(value)}
                r={selectedIndex === index ? 4.5 : 3}
                fill="white"
                stroke={line.color}
                strokeWidth="2.5"
                tabIndex={0}
                role="button"
                aria-label={`${formatTrendDate(points[index].date)} ${line.key}: ${value.toFixed(2)} litres`}
                onPointerEnter={() => onSelect(index)}
                onFocus={() => onSelect(index)}
                onClick={() => onSelect(index)}
              />
            ))}
          </g>
        ))}
        {points.map((point, index) => index % dateLabelStep === 0 || index === points.length - 1 ? (
          <text key={point.date} x={x(index)} y={height - 7} textAnchor="middle" fill="#64748b" fontSize="10">
            {formatTrendDate(point.date)}
          </text>
        ) : null)}
      </svg>
    </div>
  );
}

export default function Dashboard({ customerId, vendorId, workerId, onNavigate, missingData, onEnterMilk }: DashboardProps) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [retryCount, setRetryCount] = useState(0);
  const { t, lang } = useTranslation();
  const [trendRange, setTrendRange] = useState<TrendRange>('7d');
  const [trendView, setTrendView] = useState<TrendView>('total');
  const [trendEntries, setTrendEntries] = useState<MilkTrendEntry[]>([]);
  const [trendLoading, setTrendLoading] = useState(true);
  const [trendError, setTrendError] = useState('');
  const [selectedTrendIndex, setSelectedTrendIndex] = useState(0);
  const [trendRetryCount, setTrendRetryCount] = useState(0);

  useEffect(() => {
    const storedAuth = loadStoredAuth();
    if (!storedAuth?.token) {
      setTrendLoading(false);
      setTrendError('Unable to load milk trends. Please sign in again.');
      return;
    }
    let isActive = true;
    const { startDate, endDate } = getTrendDateRange(trendRange);
    const params = new URLSearchParams({ startDate, endDate });
    if (customerId) params.set('customerId', customerId);
    else if (vendorId) params.set('vendorId', vendorId);
    else if (workerId) params.set('workerId', workerId);

    setTrendLoading(true);
    setTrendError('');
    apiFetch<{ entries: MilkTrendEntry[] }>(
      `/api/milk-trends?${params.toString()}`,
      { headers: { Authorization: `Bearer ${storedAuth.token}` } },
      { retries: 0 }
    ).then(async (result) => {
      if (!Array.isArray(result.entries)) {
        throw new Error('Milk trends endpoint returned an invalid response.');
      }
      return result.entries;
    }).catch(async (loadError) => {
      const message = String((loadError as Error)?.message || loadError);
      console.warn('[Dashboard] Milk trends endpoint failed; trying the existing milk-entry API.', message);
      return loadMilkTrendsFromExistingEndpoints(
        startDate,
        endDate,
        customerId,
        vendorId,
        workerId,
        storedAuth.token
      );
    }).then((entries) => {
      if (!isActive) return;
      setTrendEntries(entries);
      setTrendLoading(false);
    }).catch((loadError) => {
      if (!isActive) return;
      console.error('[Dashboard] Milk trends load failed:', loadError);
      setTrendError('Unable to load milk trends. Please try again.');
      setTrendLoading(false);
    });

    return () => {
      isActive = false;
    };
  }, [customerId, vendorId, workerId, trendRange, trendRetryCount]);

  const trendPoints = useMemo(() => {
    const { startDate, endDate } = getTrendDateRange(trendRange);
    const records = new Map(trendEntries.map((entry) => [entry.date.slice(0, 10), entry]));
    const points: MilkTrendPoint[] = [];
    const day = new Date(`${startDate}T12:00:00`);
    const finalDay = new Date(`${endDate}T12:00:00`);
    while (day <= finalDay) {
      const date = localDateKey(day);
      const record = records.get(date);
      points.push({
        date,
        label: formatTrendDate(date),
        amLiters: record?.amLiters ?? null,
        pmLiters: record?.pmLiters ?? null,
        totalLiters: record?.totalLiters ?? null,
      });
      day.setDate(day.getDate() + 1);
    }
    return points;
  }, [trendEntries, trendRange]);

  useEffect(() => {
    setSelectedTrendIndex(Math.max(0, trendPoints.length - 1));
  }, [trendPoints.length, trendRange]);

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
  const todayKey = localDateKey(new Date());
  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterdayKey = localDateKey(yesterdayDate);
  const todayTrend = trendPoints.find((point) => point.date === todayKey);
  const yesterdayTrend = trendPoints.find((point) => point.date === yesterdayKey);
  const getTrendValue = (point?: MilkTrendPoint): number | null => {
    if (!point) return null;
    if (trendView === 'am') return point.amLiters;
    if (trendView === 'pm') return point.pmLiters;
    if (trendView === 'shifts') {
      const shiftValues = [point.amLiters, point.pmLiters].filter((value): value is number => value !== null);
      return shiftValues.length ? shiftValues.reduce((sum, value) => sum + value, 0) : null;
    }
    return point.totalLiters;
  };
  const todayTrendValue = getTrendValue(todayTrend);
  const yesterdayTrendValue = getTrendValue(yesterdayTrend);
  const trendDifference = todayTrendValue !== null && yesterdayTrendValue !== null
    ? todayTrendValue - yesterdayTrendValue
    : null;
  const trendPercentage = trendDifference !== null && yesterdayTrendValue !== null && yesterdayTrendValue !== 0
    ? (trendDifference / yesterdayTrendValue) * 100
    : null;
  const selectedTrend = trendPoints[Math.min(selectedTrendIndex, Math.max(0, trendPoints.length - 1))];
  const hasTrendData = trendEntries.length > 0;
  const trendScopeLabel = customerId
    ? 'Customer milk deliveries'
    : vendorId
      ? 'Vendor milk collected'
      : workerId
        ? 'Worker milk collected'
        : 'Business milk collected · all customers';

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
        <div className="lg:col-span-2 bento-card min-w-0 overflow-hidden border border-slate-100 bg-white">
          <div className="mb-4 flex flex-col gap-3 sm:mb-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h3 className="text-lg md:text-xl font-display font-bold text-slate-900 tracking-tight">Daily Milk Trends</h3>
              <p className="mt-1 text-xs font-medium text-slate-400">{trendScopeLabel}</p>
            </div>
            <div className="grid w-full grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1 sm:w-auto" aria-label="Trend date range">
              {([
                ['7d', '7 Days'],
                ['30d', '30 Days'],
                ['month', 'This Month'],
              ] as const).map(([range, label]) => (
                <button
                  key={range}
                  type="button"
                  onClick={() => setTrendRange(range)}
                  aria-pressed={trendRange === range}
                  className={`min-h-10 whitespace-nowrap rounded-lg px-1.5 py-2 text-[10px] font-bold transition-colors sm:min-h-0 sm:px-3 sm:py-1.5 sm:text-[11px] ${
                    trendRange === range
                      ? 'bg-white text-emerald-700 shadow-sm'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {trendLoading ? (
            <div className="flex h-64 items-center justify-center" aria-live="polite">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-400">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-100 border-t-emerald-600" />
                Loading milk trends…
              </div>
            </div>
          ) : trendError ? (
            <div className="flex h-64 flex-col items-center justify-center gap-2 px-4 text-center">
              <AlertCircle size={24} className="text-amber-500" />
              <p className="text-sm font-bold text-slate-700">{trendError}</p>
              <button
                type="button"
                onClick={() => setTrendRetryCount((count) => count + 1)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-emerald-700 transition-colors hover:bg-emerald-50"
              >
                Retry
              </button>
            </div>
          ) : !hasTrendData ? (
            <div className="flex h-56 flex-col items-center justify-center gap-2 px-4 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                <Milk size={22} />
              </div>
              <p className="text-sm font-bold text-slate-700">No Milk Data Yet</p>
              <p className="max-w-xs text-xs font-medium text-slate-400">
                Daily milk trends will appear here once milk entries are recorded.
              </p>
            </div>
          ) : (
            <>
              <div className="mb-3 grid grid-cols-2 gap-2 sm:mb-4 sm:grid-cols-4 sm:gap-3">
                <div className="rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2">
                  <p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">Today</p>
                  <p className="mt-0.5 truncate text-sm font-black text-slate-900">
                    {todayTrendValue === null ? 'N/A' : `${formatLiters(todayTrendValue)} L`}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2">
                  <p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">Yesterday</p>
                  <p className="mt-0.5 truncate text-sm font-black text-slate-900">
                    {yesterdayTrendValue === null ? 'N/A' : `${formatLiters(yesterdayTrendValue)} L`}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2">
                  <p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">Difference</p>
                  <p className={`mt-0.5 truncate text-sm font-black ${
                    trendDifference === null ? 'text-slate-500' : trendDifference > 0 ? 'text-emerald-700' : trendDifference < 0 ? 'text-rose-600' : 'text-slate-600'
                  }`}>
                    {trendDifference === null ? 'N/A' : `${trendDifference > 0 ? '+' : ''}${formatLiters(trendDifference)} L`}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2">
                  <p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">Change</p>
                  <p className={`mt-0.5 flex items-center gap-1 truncate text-sm font-black ${
                    trendPercentage === null ? 'text-slate-500' : trendPercentage > 0 ? 'text-emerald-700' : trendPercentage < 0 ? 'text-rose-600' : 'text-slate-600'
                  }`}>
                    {trendPercentage === null ? (
                      'N/A'
                    ) : (
                      <>
                        {trendPercentage > 0 ? <ArrowUpRight size={15} /> : trendPercentage < 0 ? <ArrowDownRight size={15} /> : <Minus size={14} />}
                        {trendPercentage > 0 ? '+' : ''}{trendPercentage.toFixed(1)}%
                      </>
                    )}
                  </p>
                </div>
              </div>

              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="min-w-0 truncate text-[10px] font-semibold text-slate-400">
                  {trendView === 'total' ? 'Daily total' : trendView === 'shifts' ? 'AM and PM by day' : `${trendView.toUpperCase()} shift`}
                </p>
                <label className="flex shrink-0 items-center gap-1.5 text-[10px] font-semibold text-slate-500">
                  <span className="sr-only">Chart detail</span>
                  <select
                    value={trendView}
                    onChange={(event) => setTrendView(event.target.value as TrendView)}
                    className="max-w-32 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[10px] font-bold text-slate-600 outline-none focus:border-emerald-500"
                    aria-label="Select milk trend detail"
                  >
                    <option value="total">Total</option>
                    <option value="shifts">AM + PM</option>
                    <option value="am">AM only</option>
                    <option value="pm">PM only</option>
                  </select>
                </label>
              </div>

              <div className="min-w-0 overflow-hidden rounded-xl border border-slate-100 bg-white px-1 py-2 sm:px-3">
                <MilkTrendChart
                  points={trendPoints}
                  view={trendView}
                  onSelect={setSelectedTrendIndex}
                />
              </div>
              {selectedTrend && (
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl bg-emerald-50/70 px-3 py-2 text-[11px]">
                  <span className="font-bold text-slate-700">{formatTrendDate(selectedTrend.date)}</span>
                  <span className="text-slate-600">AM: <strong>{selectedTrend.amLiters === null ? 'No entry' : `${formatLiters(selectedTrend.amLiters)} L`}</strong></span>
                  <span className="text-slate-600">PM: <strong>{selectedTrend.pmLiters === null ? 'No entry' : `${formatLiters(selectedTrend.pmLiters)} L`}</strong></span>
                  <span className="font-bold text-emerald-800">
                    Total: {selectedTrend.totalLiters === null ? 'No entry' : `${formatLiters(selectedTrend.totalLiters)} L`}
                  </span>
                </div>
              )}
            </>
          )}
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
