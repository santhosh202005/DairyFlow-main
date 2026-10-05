/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from 'react';
import { apiFetch } from './api';
import { clearAuth, loadStoredAuth, storeAuth, type LoginAuth } from './auth';

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
  MapPin,
  Store,
  ClipboardCheck,
  IndianRupee,
  ShieldCheck,
  ClipboardList,
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
import CattleManagement from './components/CattleManagement';
import Login from './components/Login';
import Settings from './components/Settings';
import VendorManagement from './components/VendorManagement';
import VendorRequests from './components/VendorRequests';
import WorkerManagement from './components/WorkerManagement';
import WorkerAttendance from './components/WorkerAttendance';
import WorkerSalary from './components/WorkerSalary';
import WorkerReport from './components/WorkerReport';
import UserManual from './components/UserManual';
import Billing from './components/Billing';
import LoadingScreen from './components/LoadingScreen';
import NetworkStatusModal from './components/NetworkStatusModal';
import UpdateAvailableModal from './components/UpdateAvailableModal';
import { useMissingEntries, MissingEntriesModal, NotificationBell } from './components/MissingEntriesAlert';

const CURRENT_APP_VERSION = import.meta.env.VITE_APP_VERSION || '1.0.10';
const AVAILABLE_APP_VERSION = import.meta.env.VITE_LATEST_APP_VERSION || CURRENT_APP_VERSION;
const UPDATE_DISMISSED_KEY = 'dairyflow_update_dismissed';

type View = 'dashboard' | 'customers' | 'entries' | 'advances' | 'feed' | 'cattle' | 'settings' | 'vendors' | 'vendor-requests' | 'workers' | 'attendance' | 'salary' | 'my-reports' | 'manual' | 'billing';

function isNewerVersion(current: string, available: string) {
  const currentParts = current.split('.').map(Number);
  const availableParts = available.split('.').map(Number);
  const length = Math.max(currentParts.length, availableParts.length);

  for (let index = 0; index < length; index += 1) {
    const currentPart = currentParts[index] || 0;
    const availablePart = availableParts[index] || 0;
    if (availablePart !== currentPart) return availablePart > currentPart;
  }

  return false;
}


export default function App() {
  const [activeView, setActiveView] = useState<View>(() => {
    const stored = loadStoredAuth();
    if (stored?.role === 'admin') return 'vendors';
    return 'dashboard';
  });
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [entryPrefill, setEntryPrefill] = useState<{
    shift?: 'AM' | 'PM';
    customerId?: string;
    autoOpen?: boolean;
  }>({});
  const loginGeneration = useRef(0);
  
  const [authData, setAuthData] = useState<{
    token: string | null;
    role: string | null;
    customerId?: string;
    customerName?: string;
    customerCode?: string;
    defaultRate?: number;
    customerPhone?: string;
    customerAddress?: string;
    customerGender?: 'male' | 'female';
    vendorId?: string;
    vendorName?: string;
    vendorPhone?: string;
    vendorAddress?: string;
    profilePicture?: string;
    workerId?: string;
    workerName?: string;
    workerPhone?: string;
  }>(() => {
    const stored = loadStoredAuth();
    if (!stored) return { token: null, role: null };
    return {
      token: stored.token,
      role: stored.role,
      customerId: stored.customerId,
      customerName: stored.customerName,
      customerCode: stored.customerCode,
      defaultRate: stored.defaultRate,
      customerPhone: stored.customerPhone,
      customerAddress: stored.customerAddress,
      customerGender: stored.customerGender,
      vendorId: stored.vendorId,
      vendorName: stored.vendorName,
      vendorPhone: stored.vendorPhone,
      vendorAddress: stored.vendorAddress,
      profilePicture: stored.profilePicture,
      workerId: stored.workerId,
      workerName: stored.workerName,
      workerPhone: stored.workerPhone,
    };
  });

  // Keep `useIsMobile` call unconditional to preserve hook order across renders
  const isMobile = useIsMobile();

  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isSplashFadingOut, setIsSplashFadingOut] = useState(false);
  const [isSplashComplete, setIsSplashComplete] = useState(false);
  const [isVerifying, setIsVerifying] = useState(true);
  const [serverStatus, setServerStatus] = useState<'checking' | 'starting' | 'ready'>('checking');
  const [errorMsg, setErrorMsg] = useState('');
  const [isUpdateCheckComplete, setIsUpdateCheckComplete] = useState(false);
  const [isUpdateAvailable, setIsUpdateAvailable] = useState(false);

  const { data: missingData } = useMissingEntries({
    token: authData.token,
    role: authData.role,
    customerId: authData.customerId,
    vendorId: authData.vendorId,
  });

  const handleEnterMilk = (shift?: 'AM' | 'PM', targetCustomerId?: string) => {
    setEntryPrefill({
      shift,
      customerId: targetCustomerId,
      autoOpen: true,
    });
    setActiveView('entries');
  };

  const handleEntryPrefillHandled = () => {
    setEntryPrefill((current) => current.autoOpen ? { ...current, autoOpen: false } : current);
  };

  useEffect(() => {
    const fadeTimer = setTimeout(() => {
      setIsSplashFadingOut(true);
    }, 2_650);
    const completeTimer = setTimeout(() => {
      setIsInitialLoading(false);
      setIsSplashComplete(true);
    }, 3_000);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(completeTimer);
    };
  }, []);

  useEffect(() => {
    if (!isSplashComplete) return;

    let dismissed = false;
    try {
      dismissed = localStorage.getItem(UPDATE_DISMISSED_KEY) === AVAILABLE_APP_VERSION;
    } catch {
      dismissed = false;
    }

    setIsUpdateAvailable(!dismissed && isNewerVersion(CURRENT_APP_VERSION, AVAILABLE_APP_VERSION));
    setIsUpdateCheckComplete(true);
  }, [isSplashComplete]);

  const { t } = useTranslation();

  const handleLogout = () => {
    clearAuth();
    setActiveView('dashboard');
    setIsProfileOpen(false);
    setIsSidebarOpen(true);
    setAuthData({ token: null, role: null });
  };

  const dismissUpdate = () => {
    try {
      localStorage.setItem(UPDATE_DISMISSED_KEY, AVAILABLE_APP_VERSION);
    } catch {
      // Storage can be unavailable in restricted browser contexts.
    }
    setIsUpdateAvailable(false);
  };

  useEffect(() => {
    if (!isSplashComplete) return;

    let didRun = false;
    const verificationGeneration = loginGeneration.current;

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
      if (loginGeneration.current !== verificationGeneration) return;
      console.warn('[Auth] redirectToLogin:', reason);
      clearAuth();
      setAuthData({ token: null, role: null });
      setActiveView('dashboard');
      setIsProfileOpen(false);
      setIsSidebarOpen(true);
      setIsVerifying(false);
    };

    const keepStoredSession = (reason: string) => {
      if (loginGeneration.current !== verificationGeneration) return;
      console.warn('[Auth] Keeping stored session while backend is unavailable:', reason);
      setServerStatus('starting');
      setErrorMsg('Server is starting, please wait a few seconds...');
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

    // Vendor login already persisted the complete vendor profile. Do not block
    // startup on the secondary session endpoint, which may be unavailable while
    // the production backend is waking up.
    if (stored?.role === 'vendor') {
      console.log('[Auth] Restoring stored vendor session without blocking startup.');
      setIsVerifying(false);
      return;
    }

    const verifySession = async (sessionToken: string): Promise<'valid' | 'invalid' | 'unavailable'> => {
      let lastError: unknown;

      // A sleeping backend can briefly answer 401 while its database connection
      // is recovering. Confirm the response before clearing a persisted session.
      for (let attempt = 0; attempt < 2; attempt += 1) {
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
            if (loginGeneration.current !== verificationGeneration) return 'unavailable';
            console.log('[Auth] Token valid.');
            setAuthData({
              token: sessionToken,
              role: data.role,
              customerId: data.customerId?.toString(),
              customerName: data.customerName,
              customerCode: data.customerCode,
              defaultRate: data.defaultRate,
              customerPhone: data.customerPhone,
              customerAddress: data.customerAddress,
              customerGender: data.customerGender,
              vendorId: data.vendorId?.toString(),
              vendorName: data.vendorName,
              vendorPhone: data.vendorPhone,
              vendorAddress: data.vendorAddress,
              profilePicture: data.profilePicture,
              workerId: data.workerId?.toString(),
              workerName: data.workerName,
              workerPhone: data.workerPhone,
            });
            return 'valid';
          }

          console.warn('[Auth] /api/auth/me responded but not success:', data);
          return 'invalid';
        } catch (e) {
          lastError = e;
          const message = String((e as any)?.message || e);
          if (!message.includes('HTTP 401') || attempt === 1) {
            console.error('[Auth] Token verification error:', e);
            return message.includes('HTTP 401') ? 'invalid' : 'unavailable';
          }
          await new Promise((resolve) => setTimeout(resolve, 750));
        }
      }

      console.error('[Auth] Token verification error:', lastError);
      return 'unavailable';
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
            if (loginGeneration.current !== verificationGeneration) return;
            console.log('[Auth] Backend health OK. Verifying session...');
            const sessionStatus = await verifySession(token);
            if (sessionStatus === 'invalid') {
              redirectToLogin('session verification failed');
            } else if (sessionStatus === 'unavailable') {
              keepStoredSession('session verification unavailable');
            } else {
              setServerStatus('ready');
            }
          })(),
          10_000
        );

        if (loginGeneration.current !== verificationGeneration) return;

        console.log('[Auth] Session verification flow completed.');
      } catch (err) {
        const msg = String((err as any)?.message || err);
        if (msg.includes('Hard timeout')) {
          console.warn('[Auth] Verification timed out (backend may be sleeping).');
          keepStoredSession('verification timeout');
          return;
        }

        console.warn('[Auth] Backend sleeping/unavailable:', err);
        keepStoredSession('backend unavailable');
        return;
      } finally {
        // Guarantee loader off.
        setIsVerifying(false);
      }
    };

    checkServerAndSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSplashComplete]);

  const handleLogin = async (
    token: string,
    role: string,
    customerId?: string,
    customerName?: string,
    defaultRate?: number,
    customerPhone?: string,
    customerAddress?: string,
    customerGender?: 'male' | 'female',
    vendorId?: string,
    vendorName?: string,
    vendorPhone?: string,
    vendorAddress?: string,
    customerCode?: string,
    profilePicture?: string,
    workerId?: string,
    workerName?: string,
    workerPhone?: string,
  ) => {
    loginGeneration.current += 1;
    const normalizedRole = role.toLowerCase();
    const nextAuthData = {
      token,
      role: normalizedRole,
      customerId,
      customerName,
      customerCode,
      defaultRate,
      customerPhone,
      customerAddress,
      customerGender,
      vendorId,
      vendorName,
      vendorPhone,
      vendorAddress,
      profilePicture,
      workerId,
      workerName,
      workerPhone,
    };

    // Persist and render immediately so the dashboard/redirect appears even if the
    // profile fetch is slow or temporarily unavailable.
    const loginAuth: LoginAuth = {
      token,
      role: normalizedRole,
      customerId,
      customerName,
      customerCode,
      defaultRate,
      customerPhone,
      customerAddress,
      customerGender,
      vendorId,
      vendorName,
      vendorPhone,
      vendorAddress,
      profilePicture,
      workerId,
      workerName,
      workerPhone,
    };
    try {
      storeAuth(loginAuth as any);
    } catch (err) {
      console.error('[Auth] Token storage failed:', err);
      clearAuth();
      setAuthData({ token: null, role: null });
      setErrorMsg('Unable to save your login session. Please try again.');
      return;
    }
    console.log('[Auth] Login accepted. Updating authentication state.');
    setAuthData(nextAuthData);
    setActiveView(normalizedRole === 'admin' ? 'vendors' : 'dashboard');
    console.log('[Auth] Navigation selected:', normalizedRole === 'admin' ? 'vendors' : 'dashboard');
    setIsProfileOpen(false);
    setIsVerifying(false);

    // Vendor login already returns the complete dashboard identity. Do not make
    // navigation wait for a second profile request to the production server.
    if (normalizedRole === 'vendor') return;

    // Then fetch the authoritative session profile to enrich any missing details.
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
        console.log('[Auth] Home session check succeeded:', { role: me.role, vendorId: me.vendorId, vendorName: me.vendorName });
        storeAuth({ ...loginAuth, role: me.role, vendorId: me.vendorId?.toString(), vendorName: me.vendorName, vendorPhone: me.vendorPhone, vendorAddress: me.vendorAddress, profilePicture: me.profilePicture } as any);
        setAuthData({
          token,
          role: me.role,
          customerId: me.customerId?.toString(),
          customerName: me.customerName,
          customerCode: me.customerCode,
          defaultRate: me.defaultRate,
          customerPhone: me.customerPhone,
          customerAddress: me.customerAddress,
          customerGender: me.customerGender,
          vendorId: me.vendorId?.toString(),
          vendorName: me.vendorName,
          vendorPhone: me.vendorPhone,
          vendorAddress: me.vendorAddress,
          profilePicture: me.profilePicture,
          workerId: me.workerId?.toString(),
          workerName: me.workerName,
          workerPhone: me.workerPhone,
        });
      } else console.warn('[Auth] Home session check returned an unsuccessful response:', me);
    } catch (err) {
      console.warn('[Auth] handleLogin profile refresh failed, keeping login payload state:', err);
    }
  };


  if (isInitialLoading || isVerifying || !isUpdateCheckComplete) {
    return (
      <>
        <LoadingScreen 
          message={serverStatus === 'starting' ? t('connectingToServer') : t('loadingDairyFlow')} 
          isFadingOut={isSplashFadingOut}
        />
        <NetworkStatusModal />
      </>
    );
  }

  if (!authData.token) {
    return (
      <>
        <Login onLogin={handleLogin} />
        {isUpdateAvailable && (
          <UpdateAvailableModal
            currentVersion={CURRENT_APP_VERSION}
            newVersion={AVAILABLE_APP_VERSION}
            onCancel={dismissUpdate}
          />
        )}
        <NetworkStatusModal />
      </>
    );
  }

  const navLabel = (key: string, fallback: string) => t(key) || fallback;

  const navItems = [
    ...(authData.role === 'admin' ? [
      { id: 'vendors', label: navLabel('vendors', 'Vendors'), icon: Store },
      { id: 'vendor-requests', label: 'Pending Requests', icon: ClipboardList },
      { id: 'customers', label: navLabel('farmers', 'Farmers'), icon: Users },
    ] : [
      { id: 'dashboard', label: navLabel('monitor', 'Monitor'), icon: LayoutDashboard },
    ]),
    { id: 'manual', label: 'Manual', icon: Info },
    ...(authData.role === 'vendor' ? [
      { id: 'workers', label: navLabel('workers', 'Workers'), icon: Store },
      { id: 'attendance', label: navLabel('attendance', 'Attendance'), icon: ClipboardCheck },
      { id: 'salary', label: navLabel('salary', 'Salary'), icon: IndianRupee },
      { id: 'customers', label: navLabel('farmers', 'Farmers'), icon: Users },
      { id: 'entries', label: navLabel('logistics', 'Logistics'), icon: Milk },
      { id: 'billing', label: navLabel('billing', 'Reports & Bills'), icon: FileText },
      { id: 'advances', label: navLabel('ledger', 'Ledger'), icon: Wallet },
      { id: 'feed', label: navLabel('resources', 'Resources'), icon: Package },
      { id: 'cattle', label: navLabel('cattleRecords', 'Cattle & Vaccines'), icon: ShieldCheck },
    ] : authData.role === 'worker' ? [
      { id: 'entries', label: navLabel('logistics', 'Logistics'), icon: Milk },
      { id: 'my-reports', label: navLabel('myReports', 'My Salary & Reports'), icon: FileText },
    ] : authData.role === 'customer' ? [
      { id: 'entries', label: navLabel('mySupply', 'My Supply'), icon: Milk },
      { id: 'billing', label: navLabel('myReports', 'My Reports & Bills'), icon: FileText },
      { id: 'cattle', label: navLabel('cattleRecords', 'Cattle & Vaccines'), icon: ShieldCheck },
      { id: 'advances', label: navLabel('myLedger', 'My Ledger'), icon: Wallet },
      { id: 'feed', label: navLabel('myStocks', 'My Stocks'), icon: Package },
    ] : []),
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
          <div className="w-12 h-12 rounded-[1.2rem] flex items-center justify-center shrink-0 overflow-hidden bg-transparent">
            <img src="/new%20dairy%20flow.png" alt="DairyFlow Logo" className="w-full h-full object-contain drop-shadow-[0_4px_10px_rgba(16,185,129,0.18)]" />
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
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-transparent overflow-hidden shrink-0 md:hidden">
              <img src="/new%20dairy%20flow.png" alt="DairyFlow Logo" className="w-full h-full object-contain drop-shadow-[0_3px_8px_rgba(16,185,129,0.18)]" />
            </div>
            <h1 className="text-[17px] md:text-3xl font-display font-bold text-slate-900 tracking-tight capitalize truncate max-w-[35vw] md:max-w-none">
              {activeView === 'dashboard' ? t('dashboard') 
                : activeView === 'customers' ? t('farmers')
                : activeView === 'entries' ? t('milkSupply')
                : activeView === 'billing' ? (authData.role === 'customer' ? t('myReports') : t('reportsBilling'))
                : activeView === 'advances' ? t('advances')
                : activeView === 'feed' ? t('cattleFeed')
                : activeView === 'cattle' ? (t('cattleManagement') || 'Farm & Cattle')
                : activeView === 'vendor-requests' ? 'Pending Vendor Requests'
                : activeView === 'settings' ? t('settings')
                : (activeView as string).replace('-', ' ')}
            </h1>

          </div>
          
          <div className="flex shrink-0 items-center gap-2 md:gap-6 relative">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-bold text-slate-900 leading-none mb-1">
                {authData.role === 'admin' ? 'Administrator' : authData.role === 'vendor' ? authData.vendorName : authData.role === 'worker' ? authData.workerName : authData.customerName}
              </p>
              <span className="inline-block px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-black uppercase tracking-wider">
                {authData.role === 'admin' ? 'Owner' : authData.role === 'vendor' ? 'Vendor' : authData.role === 'worker' ? 'Worker' : 'Farmer'}
              </span>
            </div>

            {/* Notification Bell for Customer & Vendor */}
            <NotificationBell
              data={missingData}
              role={authData.role}
              onEnterMilk={handleEnterMilk}
            />

            <div 
              onClick={() => setIsProfileOpen(!isProfileOpen)}
              className="w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl bg-white border-2 border-slate-100 shadow-soft overflow-hidden p-0.5 md:p-1 transition-transform hover:scale-105 cursor-pointer relative z-50 touch-btn flex items-center justify-center"
            >
              <img 
                src={authData.profilePicture || `https://api.dicebear.com/7.x/avataaars/svg?seed=${authData.role === 'admin' ? 'dairy' : authData.role === 'vendor' ? (authData.vendorName || 'vendor') : authData.role === 'worker' ? (authData.workerName || 'worker') : authData.customerId}&gender=${authData.customerGender || 'male'}`} 
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
                      <p className="font-bold text-slate-900">
                        {authData.role === 'admin' ? t('administrator') : authData.role === 'vendor' ? authData.vendorName : authData.role === 'worker' ? authData.workerName : authData.customerName}
                      </p>
                      <p className="text-xs text-slate-500 font-medium">
                        {authData.role === 'admin' ? t('systemOwner') : authData.role === 'vendor' ? `Vendor Account` : authData.role === 'worker' ? `Worker Account` : `Farmer ID: ${authData.customerCode || '#' + authData.customerId}`}
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
              {activeView === 'dashboard' && <Dashboard customerId={authData.customerId} vendorId={authData.vendorId} workerId={authData.workerId} onNavigate={setActiveView} missingData={missingData} onEnterMilk={handleEnterMilk} />}
              {activeView === 'manual' && <UserManual userRole={authData.role ?? undefined} />}
              {activeView === 'vendors' && authData.role === 'admin' && (
                <VendorManagement onNavigateToRequests={() => setActiveView('vendor-requests')} />
              )}
              {activeView === 'vendor-requests' && authData.role === 'admin' && <VendorRequests />}
              {activeView === 'workers' && authData.role === 'vendor' && <WorkerManagement vendorId={authData.vendorId} />}
              {activeView === 'attendance' && authData.role === 'vendor' && <WorkerAttendance vendorId={authData.vendorId} />}
              {activeView === 'salary' && authData.role === 'vendor' && <WorkerSalary vendorId={authData.vendorId} />}
              {activeView === 'my-reports' && authData.role === 'worker' && <WorkerReport workerId={authData.workerId} vendorId={authData.vendorId} workerName={authData.workerName} />}
              {activeView === 'customers' && (authData.role === 'admin' || authData.role === 'vendor') && <Customers vendorId={authData.vendorId} isVendor={authData.role === 'vendor'} readOnly={authData.role === 'admin'} />}
              {activeView === 'entries' && authData.role !== 'admin' && <MilkEntries customerId={authData.customerId} vendorId={authData.vendorId} workerId={authData.workerId} workerName={authData.workerName} isAdmin={false} isVendor={authData.role === 'vendor' || authData.role === 'worker'} isWorker={authData.role === 'worker'} defaultRate={authData.defaultRate} initialShift={entryPrefill.shift} initialCustomerId={entryPrefill.customerId} autoOpenModal={entryPrefill.autoOpen} onAutoOpenHandled={handleEntryPrefillHandled} />}
              {activeView === 'billing' && (
                <Billing 
                  customerId={authData.customerId} 
                  isWorker={authData.role === 'worker'}
                  workerId={authData.workerId}
                  isCustomer={authData.role === 'customer'}
                />
              )}
              {activeView === 'advances' && authData.role !== 'admin' && authData.role !== 'worker' && <Advances customerId={authData.customerId} vendorId={authData.vendorId} isAdmin={false} isVendor={authData.role === 'vendor'} />}
              {activeView === 'feed' && authData.role !== 'admin' && authData.role !== 'worker' && <CattleFeed customerId={authData.customerId} vendorId={authData.vendorId} isAdmin={false} isVendor={authData.role === 'vendor'} />}
              {activeView === 'cattle' && (authData.role === 'customer' || authData.role === 'vendor' || authData.role === 'admin') && (
                <CattleManagement 
                  customerId={authData.customerId} 
                  vendorId={authData.vendorId} 
                  isAdmin={authData.role === 'admin'} 
                  isVendor={authData.role === 'vendor'} 
                  isFarmer={authData.role === 'customer'} 
                />
              )}
              {activeView === 'settings' && (
                <Settings 
                  authData={authData} 
                  onLogout={handleLogout} 
                  onProfileUpdate={(pic) => {
                    setAuthData(prev => ({ ...prev, profilePicture: pic }));
                    const stored = loadStoredAuth();
                    if (stored) {
                      storeAuth({ ...stored, profilePicture: pic });
                    }
                  }} 
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {isUpdateAvailable && (
        <UpdateAvailableModal
          currentVersion={CURRENT_APP_VERSION}
          newVersion={AVAILABLE_APP_VERSION}
          onCancel={dismissUpdate}
        />
      )}

      <MissingEntriesModal
        data={missingData}
        role={authData.role}
        onEnterMilk={handleEnterMilk}
      />

      {/* Mobile Bottom Navigation */}
      {isMobile && (
        <nav className="fixed bottom-0 left-0 right-0 z-[85] bg-white/98 backdrop-blur-xl border-t border-slate-100 shadow-[0_-4px_24px_rgba(0,0,0,0.08)] safe-area-inset-bottom">
          <div className="flex items-stretch overflow-x-auto scrollbar-none">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeView === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveView(item.id as View)}
                  className={`flex-shrink-0 min-w-[72px] flex flex-col items-center justify-center py-2.5 px-2 transition-all relative touch-btn ${
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
                  <span className={`relative z-10 mt-1 text-center leading-none font-bold whitespace-nowrap ${
                    isActive ? 'text-[11px] text-emerald-600' : 'text-[10px] text-slate-400'
                  }`}>{item.label}</span>
                </button>
              );
            })}
          </div>
        </nav>
      )}

      {/* Global Network Connectivity Detector Modal */}
      <NetworkStatusModal />
    </div>
  );
}

