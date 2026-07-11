/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { apiFetch } from './api';
import { clearAuth, loadStoredAuth, storeAuth } from './auth';

import { 
  LayoutDashboard, 
  Users, 
  Milk, 
  Wallet, 
  FileText, 
  ChevronRight,
  Menu,
  X,
  Info,
  LogOut,
  Package,
  Settings as SettingsIcon,
  User,
  Phone,
  MapPin
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Dashboard from './components/Dashboard';
import { useTranslation } from './i18n';

function useIsMobile(query = '(max-width: 768px)') {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth <= 768;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return isMobile;
}

import Customers from './components/Customers';
import MilkEntries from './components/MilkEntries';
import Advances from './components/Advances';
import CattleFeed from './components/CattleFeed';
import Login from './components/Login';
import Settings from './components/Settings';

type View = 'dashboard' | 'customers' | 'entries' | 'advances' | 'feed' | 'settings';

export default function App() {
  const [activeView, setActiveView] = useState<View>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  
  const [authData, setAuthData] = useState<{
    token: string | null;
    role: string | null;
    customerId?: string;
    customerName?: string;
    defaultRate?: number;
    customerPhone?: string;
    customerAddress?: string;
    customerGender?: 'male' | 'female';
  }>(() => {
    const stored = loadStoredAuth();
    if (!stored) return { token: null, role: null };
    return {
      token: stored.token,
      role: stored.role,
      customerId: stored.customerId,
      customerName: stored.customerName,
      defaultRate: stored.defaultRate,
      customerPhone: stored.customerPhone,
      customerAddress: stored.customerAddress,
      customerGender: stored.customerGender,
    };
  });

  // Keep `useIsMobile` call unconditional to preserve hook order across renders
  const isMobile = useIsMobile();

  const [isVerifying, setIsVerifying] = useState(true);
  const [serverStatus, setServerStatus] = useState<'checking' | 'starting' | 'ready'>('checking');
  const [errorMsg, setErrorMsg] = useState('');

  const { t } = useTranslation();

  const handleLogout = () => {
    clearAuth();
    setActiveView('dashboard');
    setIsProfileOpen(false);
    setIsSidebarOpen(true);
    setAuthData({ token: null, role: null });
  };

  useEffect(() => {
    let didRun = false;

    const withHardTimeout = async <T,>(promise: Promise<T>, ms: number): Promise<T> => {
      return await new Promise<T>((resolve, reject) => {
        const t = setTimeout(() => reject(new Error(`Hard timeout after ${ms}ms`)), ms);
        promise
          .then((v) => {
            clearTimeout(t);
            resolve(v);
          })
          .catch((err) => {
            clearTimeout(t);
            reject(err);
          });
      });
    };

    const redirectToLogin = (reason: string) => {
      console.warn('[Auth] redirectToLogin:', reason);
      clearAuth();
      setAuthData({ token: null, role: null });
      setActiveView('dashboard');
      setIsProfileOpen(false);
      setIsSidebarOpen(true);
      setIsVerifying(false);
    };

    if (didRun) return;
    didRun = true;

    const stored = loadStoredAuth();
    const token = stored?.token;

    console.log('[Auth] Starting session verification. HasToken=', !!token);

    // If no token exists, stop verifying immediately and show Login.
    if (!token) {
      setServerStatus('checking');
      setIsVerifying(false);
      setErrorMsg('');
      console.log('[Auth] No token found. Showing login.');
      return;
    }

    const verifySession = async (sessionToken: string) => {
      try {
        const data = await apiFetch<any>(
          '/api/auth/me',
          {
            headers: {
              Authorization: `Bearer ${sessionToken}`,
            },
          },
          // Keep apiFetch retries, but hard-timeout the whole flow below.
          { retries: 6, delayMs: 1000 }
        );

        if (data?.success) {
          console.log('[Auth] Token valid.');
          setAuthData({
            token: sessionToken,
            role: data.role,
            customerId: data.customerId?.toString(),
            customerName: data.customerName,
            defaultRate: data.defaultRate,
            customerPhone: data.customerPhone,
            customerAddress: data.customerAddress,
            customerGender: data.customerGender,
          });
          return true;
        }

        console.warn('[Auth] /api/auth/me responded but not success:', data);
        return false;
      } catch (e) {
        console.error('[Auth] Token verification error:', e);
        return false;
      }
    };

    const checkServerAndSession = async () => {
      try {
        setServerStatus('checking');
        setErrorMsg('');

        // Run health + session verification under a single hard 10s timeout.
        await withHardTimeout(
          (async () => {
            console.log('[Auth] Checking backend health...');
            await apiFetch('/api/health', { method: 'GET' }, { retries: 6, delayMs: 1500 });
            console.log('[Auth] Backend health OK. Verifying session...');
            await verifySession(token);
          })(),
          10_000
        );

        // If verification succeeded, authData.token should be set by verifySession.
        // If it didn't, treat as invalid/expired.
        if (!loadStoredAuth()?.token) {
          console.warn('[Auth] Token cleared during verification. Showing login.');
          redirectToLogin('token cleared');
          return;
        }

        // If verifySession didn't set authData, we still redirect to login.
        // (Using current state is not reliable immediately, so we also accept a no-token final state.)
        if (!token) {
          console.warn('[Auth] No token available after verification. Showing login.');
          redirectToLogin('no token after verification');
          return;
        }

        console.log('[Auth] Session verification flow completed.');
      } catch (err) {
        const msg = String((err as any)?.message || err);
        if (msg.includes('Hard timeout')) {
          console.warn('[Auth] Verification timed out (backend may be sleeping).');
          setServerStatus('starting');
          setErrorMsg('Server is starting, please wait a few seconds...');
          redirectToLogin('verification timeout');
          return;
        }

        console.warn('[Auth] Backend sleeping/unavailable:', err);
        setServerStatus('starting');
        setErrorMsg('Server is starting, please wait a few seconds...');
        redirectToLogin('backend unavailable');
        return;
      } finally {
        // Guarantee loader off.
        setIsVerifying(false);
      }
    };

    checkServerAndSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLogin = async (
    token: string,
    role: string,
    customerId?: string,
    customerName?: string,
    defaultRate?: number,
    customerPhone?: string,
    customerAddress?: string,
    customerGender?: 'male' | 'female'
  ) => {
    // Persist what we have immediately so navigation feels instant.
    storeAuth({
      token,
      role: role as any,
      customerId,
      customerName,
      defaultRate,
      customerPhone,
      customerAddress,
      customerGender,
    });

    // Then fetch the authoritative session profile (so Settings/header always get full details).
    try {
      const me = await apiFetch<any>(
        '/api/auth/me',
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
        { retries: 6, delayMs: 1200 }
      );

      if (me?.success) {
        setAuthData({
          token,
          role: me.role,
          customerId: me.customerId?.toString(),
          customerName: me.customerName,
          defaultRate: me.defaultRate,
          customerPhone: me.customerPhone,
          customerAddress: me.customerAddress,
          customerGender: me.customerGender,
        });
      } else {
        // Fallback to the login payload if /api/auth/me doesn't return success.
        setAuthData({ token, role, customerId, customerName, defaultRate, customerPhone, customerAddress, customerGender });
      }
    } catch {
      // If backend is sleeping/slow, fallback immediately.
      setAuthData({ token, role, customerId, customerName, defaultRate, customerPhone, customerAddress, customerGender });
    }

    setActiveView('dashboard');
    setIsProfileOpen(false);
  };


  if (isVerifying) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-slate-100 p-8 text-center space-y-6">
          <div className="w-20 h-20 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto shadow-inner relative">
            <div className="absolute inset-0 rounded-2xl border-4 border-emerald-500/20 border-t-emerald-600 animate-spin" />
            <img src="/logo.jpg" alt="DairyFlow Logo" className="w-14 h-14 object-cover rounded-xl" />
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-display font-bold text-slate-900">
              {serverStatus === 'starting' ? 'Connecting to Server' : 'Verifying Session'}
            </h3>
            <p className="text-sm text-slate-400 font-medium leading-relaxed">
              {serverStatus === 'starting' 
                ? 'Server is starting, please wait a few seconds...' 
                : 'Restoring your session details, please wait...'}
            </p>
          </div>
          {errorMsg && (
            <div className="p-3 bg-rose-50 text-rose-600 text-xs font-bold rounded-xl border border-rose-100">
              {errorMsg}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (!authData.token) {
    return <Login onLogin={handleLogin} />;
  }

  const navLabel = (key: string, fallback: string) => t(key) || fallback;

  const navItems = [
    { id: 'dashboard', label: navLabel('monitor', 'Monitor'), icon: LayoutDashboard },
    ...(authData.role === 'admin' ? [
      { id: 'customers', label: navLabel('farmers', 'Farmers'), icon: Users },
      { id: 'entries', label: navLabel('logistics', 'Logistics'), icon: Milk },
      { id: 'advances', label: navLabel('ledger', 'Ledger'), icon: Wallet },
      { id: 'feed', label: navLabel('resources', 'Resources'), icon: Package },
    ] : [
      { id: 'entries', label: navLabel('mySupply', 'My Supply'), icon: Milk },
      { id: 'advances', label: navLabel('myLedger', 'My Ledger'), icon: Wallet },
      { id: 'feed', label: navLabel('myStocks', 'My Stocks'), icon: Package },
    ]),
    { id: 'settings', label: navLabel('settings', 'Settings'), icon: SettingsIcon },
  ];

  return (
    <div className="min-h-screen bg-[#F9FAFB] flex font-sans text-slate-900">
      {/* Sidebar — desktop only */}
      <aside 
        className={`bg-white border-r border-slate-200 transition-all duration-500 ease-in-out flex-col relative z-20 ${
          isMobile ? 'hidden' : (isSidebarOpen ? 'w-72 flex' : 'w-24 flex')
        }`}
      >
        <div className="p-8 flex items-center gap-4 border-b border-slate-50">
          <div className="w-12 h-12 rounded-[1.2rem] flex items-center justify-center shrink-0 overflow-hidden bg-white shadow-sm border border-slate-100">
            <img src="/logo.jpg" alt="DairyFlow Logo" className="w-full h-full object-cover" />
          </div>
          <AnimatePresence>
            {isSidebarOpen && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="overflow-hidden"
              >
                <span className="font-brand font-bold text-2xl tracking-tight text-slate-900 block leading-tight">DairyFlow</span>
                <span className="font-display text-[10px] text-emerald-600 font-semibold uppercase tracking-[0.2em] block leading-none">Management</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <nav className="flex-1 p-6 space-y-3 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveView(item.id as View)}
                className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all relative group ${
                  isActive 
                    ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-100' 
                    : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600'
                }`}
              >
                <Icon size={22} className={isActive ? 'text-white' : 'group-hover:scale-110 transition-transform'} />
                {isSidebarOpen && <span className="font-medium text-sm">{item.label}</span>}
                {isActive && isSidebarOpen && (
                  <motion.div 
                    layoutId="active-dot"
                    className="ml-auto w-1.5 h-1.5 bg-white rounded-full"
                  />
                )}
              </button>
            );
          })}
        </nav>

        <div className="p-6 border-t border-slate-50">
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="w-full flex items-center justify-center p-3 text-slate-300 hover:text-slate-500 hover:bg-slate-50 rounded-xl transition-all cursor-pointer"
          >
            <motion.div animate={{ rotate: isSidebarOpen ? 0 : 180 }}>
              {isSidebarOpen ? <X size={20} /> : <ChevronRight size={20} />}
            </motion.div>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto relative glass-card flex flex-col">
        <header className="bg-white/90 backdrop-blur-xl border-b border-slate-100 px-3 py-3 md:px-10 md:py-5 sticky top-0 z-30 flex justify-between items-center shadow-soft">
          <h1 className="text-[17px] md:text-3xl font-display font-bold text-slate-900 tracking-tight capitalize truncate max-w-[55vw] md:max-w-none">
            {activeView === 'dashboard' ? t('dashboard') 
              : activeView === 'customers' ? t('farmers')
              : activeView === 'entries' ? t('milkSupply')
              : activeView === 'advances' ? t('advances')
              : activeView === 'feed' ? t('cattleFeed')
              : activeView === 'settings' ? t('settings')
              : (activeView as string).replace('-', ' ')}
          </h1>
          
          <div className="flex items-center gap-2 md:gap-6 relative">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-bold text-slate-900 leading-none mb-1">{authData.role === 'admin' ? 'Administrator' : authData.customerName}</p>
              <span className="inline-block px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-black uppercase tracking-wider">
                {authData.role === 'admin' ? 'Owner' : 'Farmer'}
              </span>
            </div>
            <div 
              onClick={() => setIsProfileOpen(!isProfileOpen)}
              className="w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl bg-white border-2 border-slate-100 shadow-soft overflow-hidden p-0.5 md:p-1 transition-transform hover:scale-105 cursor-pointer relative z-50 touch-btn flex items-center justify-center"
            >
              <img 
                src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${authData.role === 'admin' ? 'dairy' : authData.customerId}&gender=${authData.customerGender || 'male'}`} 
                alt="Profile" 
                className="w-full h-full rounded-xl object-cover"
                referrerPolicy="no-referrer"
              />
            </div>

            <AnimatePresence>
              {isProfileOpen && (
                <>
                  <div 
                    className="fixed inset-0 z-40" 
                    onClick={() => setIsProfileOpen(false)}
                  ></div>
                  <motion.div 
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute top-16 right-0 w-64 bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden z-50"
                  >
                    <div className="p-4 border-b border-slate-50 bg-slate-50/50">
                      <p className="font-bold text-slate-900">{authData.role === 'admin' ? t('administrator') : authData.customerName}</p>
                      <p className="text-xs text-slate-500 font-medium">
                        {authData.role === 'admin' ? t('systemOwner') : `Farmer ID: #${authData.customerId}`}
                      </p>
                      {authData.defaultRate && (
                        <p className="text-xs text-emerald-600 font-bold mt-1">
                          Default Rate: ₹{authData.defaultRate}/L
                        </p>
                      )}
                      {(authData.customerPhone || authData.customerAddress) && (
                        <div className="mt-3 pt-3 border-t border-slate-200/60 space-y-2">
                          {authData.customerPhone && (
                            <div className="flex items-center gap-2 text-xs text-slate-600">
                              <Phone size={12} className="text-slate-400" />
                              <span>{authData.customerPhone}</span>
                            </div>
                          )}
                          {authData.customerAddress && (
                            <div className="flex items-start gap-2 text-xs text-slate-600">
                              <MapPin size={12} className="text-slate-400 mt-0.5 shrink-0" />
                              <span className="leading-tight">{authData.customerAddress}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="p-2">
                      <button 
                        onClick={() => {
                          setActiveView('settings');
                          setIsProfileOpen(false);
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-colors cursor-pointer"
                      >
                        <User size={16} />
                        {t('myProfile')}
                      </button>
                      <button 
                        onClick={() => {
                          setActiveView('settings');
                          setIsProfileOpen(false);
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-colors cursor-pointer"
                      >
                        <SettingsIcon size={16} />
                        {t('accountSettings')}
                      </button>
                    </div>
                    <div className="p-2 border-t border-slate-50">
                      <button 
                        onClick={() => {
                          setIsProfileOpen(false);
                          handleLogout();
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
                      >
                        <LogOut size={16} />
                        {t('signOut')}
                      </button>
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </header>

        <div className="p-3 md:p-10 max-w-7xl mx-auto flex-1 mobile-bottom-padding">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeView}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ 
                type: "spring",
                stiffness: 260,
                damping: 20 
              }}
            >
              {activeView === 'dashboard' && <Dashboard customerId={authData.customerId} onNavigate={setActiveView} />}
              {activeView === 'customers' && authData.role === 'admin' && <Customers />}
              {activeView === 'entries' && <MilkEntries customerId={authData.customerId} isAdmin={authData.role === 'admin'} defaultRate={authData.defaultRate} />}
              {activeView === 'advances' && <Advances customerId={authData.customerId} isAdmin={authData.role === 'admin'} />}
              {activeView === 'feed' && <CattleFeed customerId={authData.customerId} isAdmin={authData.role === 'admin'} />}
              {activeView === 'settings' && <Settings authData={authData} onLogout={handleLogout} />}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      {isMobile && (
        <nav className="fixed bottom-0 left-0 right-0 z-[85] bg-white/98 backdrop-blur-xl border-t border-slate-100 shadow-[0_-4px_24px_rgba(0,0,0,0.08)] safe-area-inset-bottom">
          <div className="flex items-stretch">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeView === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveView(item.id as View)}
                  className={`flex-1 min-w-0 flex flex-col items-center justify-center py-2.5 px-1 transition-all relative touch-btn ${
                    isActive ? 'text-emerald-600' : 'text-slate-400'
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="mobile-active-bg"
                      className="absolute inset-x-1 inset-y-0.5 rounded-xl bg-emerald-50"
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    />
                  )}
                  <Icon
                    size={isActive ? 22 : 20}
                    className="relative z-10 transition-all duration-200"
                    strokeWidth={isActive ? 2.5 : 2}
                  />
                  <span className={`relative z-10 mt-1 truncate w-full text-center leading-none font-bold ${
                    isActive ? 'text-[11px] text-emerald-600' : 'text-[10px] text-slate-400'
                  }`}>{item.label}</span>
                </button>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
}

