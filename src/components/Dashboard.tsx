import { useState, useEffect } from 'react';
import { Users, Milk, TrendingUp, AlertCircle, Package, Wallet } from 'lucide-react';
import { useTranslation } from '../i18n';
import { Stats } from '../types';

interface DashboardProps {
  customerId?: string;
  onNavigate?: (view: any) => void;
}

export default function Dashboard({ customerId, onNavigate }: DashboardProps) {
  const [stats, setStats] = useState<Stats | null>(null);
  const { t } = useTranslation();

  useEffect(() => {
    const url = customerId ? `/api/stats?customerId=${customerId}` : '/api/stats';
    fetch(url)
      .then(res => res.json())
      .then(data => setStats(data));
  }, [customerId]);

  if (!stats) return <div className="animate-pulse">Loading stats...</div>;

  const statCards = [
    ...(customerId ? [] : [{ label: t('totalCustomers'), value: stats.totalCustomers, icon: Users, color: 'bg-blue-500' }]),
    { 
      label: t('todaysSupply'), 
      value: `${stats.todaySupply} L`, 
      icon: Milk, 
      color: 'bg-emerald-500',
      subtext: `AM: ${stats.todayAM}L | PM: ${stats.todayPM}L`
    },
    { label: t('feedCharges'), value: `₹${stats.monthlyFeed || 0}`, icon: Package, color: 'bg-orange-500' },
    { label: customerId ? t('monthlyRevenue') : t('monthlyRevenue'), value: `₹${stats.monthlyRevenue}`, icon: TrendingUp, color: 'bg-violet-500' },
    { label: customerId ? t('pendingPayments') : t('pendingPayments'), value: `₹${stats.pendingPayments}`, icon: AlertCircle, color: 'bg-amber-500' },
  ];

  return (
    <div className="space-y-6 md:space-y-12">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 md:gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2 md:mb-3">
            <span className="px-3 py-1 bg-emerald-100 text-emerald-700 text-[10px] font-black rounded-full uppercase tracking-[0.15em]">
              {customerId ? t('monitor') : t('administratorControl')}
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
            {customerId ? "Real-time metrics for your dairy supply and financial standing." : t('administratorControl')}
          </p>
        </div>
        <div className="bg-white px-4 py-2 md:px-6 md:py-3 rounded-[1.2rem] border border-slate-100 shadow-soft">
          <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mb-0.5 md:mb-1">{t('observationDate')}</p>
          <p className="text-sm font-black text-slate-900">{new Date().toLocaleDateString('en-IN', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
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
        <div className="lg:col-span-2 bento-card border-slate-200/50 bg-white/40 backdrop-blur-sm">
          <div className="flex items-center justify-between mb-6 md:mb-10">
            <h3 className="text-lg md:text-xl font-display font-bold text-slate-900 tracking-tight">Recent Activity</h3>
            <div className="px-3 py-1 rounded-full bg-slate-100 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
              Live Feed
            </div>
          </div>
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center text-slate-300">
              <TrendingUp size={32} />
            </div>
            <div>
              <p className="font-bold text-slate-400 text-sm">System Quiescent</p>
              <p className="text-xs text-slate-300 font-medium">Historical logs will manifest here momentarily.</p>
            </div>
          </div>
        </div>
        
        {!customerId && (
          <div className="bento-card border-emerald-100 bg-emerald-50/20">
            <h3 className="text-xl font-display font-bold text-slate-900 tracking-tight mb-8">Operations</h3>
            <div className="grid grid-cols-1 gap-4">
              <button 
                onClick={() => onNavigate?.('entries')}
                className="flex items-center gap-4 p-5 rounded-2xl bg-white border border-slate-100 shadow-soft hover:shadow-medium hover:scale-[1.02] transition-all group text-left"
              >
                <div className="w-12 h-12 rounded-[1rem] bg-emerald-600 text-white flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                  <Milk size={20} />
                </div>
                <div>
                  <p className="font-bold text-slate-900 text-sm">Record Milk</p>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Log daily supply</p>
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
                  <p className="font-bold text-slate-900 text-sm">Onboard Farmer</p>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Register new account</p>
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
                  <p className="font-bold text-slate-900 text-sm">Distribute Funds</p>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Manage advances</p>
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
                  <p className="font-bold text-slate-900 text-sm">Cattle Resource</p>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Log feed inventory</p>
                </div>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
