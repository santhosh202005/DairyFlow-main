/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
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
  Settings,
  User,
  Phone,
  MapPin
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Dashboard from './components/Dashboard';

function useIsMobile(query = '(max-width: 768px)') {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia(query).matches;
    }
    return false;
  });

  useEffect(() => {
    const mql = window.matchMedia?.(query);
    if (!mql) return;
    const onChange = () => setIsMobile(!!mql.matches);
    
    if (mql.addEventListener) {
      mql.addEventListener('change', onChange);
    } else {
      mql.addListener(onChange);
    }

    onChange();

    return () => {
      if (mql.removeEventListener) {
        mql.removeEventListener('change', onChange);
      } else {
        mql.removeListener(onChange);
      }
    };
  }, [query]);

  return isMobile;
}

import Customers from './components/Customers';
import MilkEntries from './components/MilkEntries';
import Advances from './components/Advances';
import Billing from './components/Billing';
import CattleFeed from './components/CattleFeed';
import About from './components/About';
import Login from './components/Login';

type View = 'dashboard' | 'customers' | 'entries' | 'advances' | 'billing' | 'feed' | 'about';

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
  }>(() => {
    const token = localStorage.getItem('dairy_auth_token');
    const role = localStorage.getItem('dairy_auth_role');
    const customerId = localStorage.getItem('dairy_auth_customer_id');
    const customerName = localStorage.getItem('dairy_auth_customer_name');
    const defaultRate = localStorage.getItem('dairy_auth_default_rate');
    const customerPhone = localStorage.getItem('dairy_auth_customer_phone');
    const customerAddress = localStorage.getItem('dairy_auth_customer_address');
    return { 
      token, 
      role, 
      customerId: customerId || undefined,
      customerName: customerName || undefined,
      defaultRate: defaultRate ? parseFloat(defaultRate) : undefined,
      customerPhone: customerPhone || undefined,
      customerAddress: customerAddress || undefined
    };
  });

  const handleLogin = (token: string, role: string, customerId?: string, customerName?: string, defaultRate?: number, customerPhone?: string, customerAddress?: string) => {
    localStorage.setItem('dairy_auth_token', token);
    localStorage.setItem('dairy_auth_role', role);
    if (customerId) localStorage.setItem('dairy_auth_customer_id', customerId);
    if (customerName) localStorage.setItem('dairy_auth_customer_name', customerName);
    if (defaultRate) localStorage.setItem('dairy_auth_default_rate', defaultRate.toString());
    if (customerPhone) localStorage.setItem('dairy_auth_customer_phone', customerPhone);
    if (customerAddress) localStorage.setItem('dairy_auth_customer_address', customerAddress);
    setAuthData({ token, role, customerId, customerName, defaultRate, customerPhone, customerAddress });
  };

  const handleLogout = () => {
    localStorage.removeItem('dairy_auth_token');
    localStorage.removeItem('dairy_auth_role');
    localStorage.removeItem('dairy_auth_customer_id');
    localStorage.removeItem('dairy_auth_customer_name');
    localStorage.removeItem('dairy_auth_default_rate');
    localStorage.removeItem('dairy_auth_customer_phone');
    localStorage.removeItem('dairy_auth_customer_address');
    setAuthData({ token: null, role: null });
  };

  if (!authData.token) {
    return <Login onLogin={handleLogin} />;
  }

  const navItems = [
    { id: 'dashboard', label: 'Monitor', icon: LayoutDashboard },
    ...(authData.role === 'admin' ? [
      { id: 'customers', label: 'Farmers', icon: Users },
      { id: 'entries', label: 'Logistics', icon: Milk },
      { id: 'advances', label: 'Ledger', icon: Wallet },
      { id: 'feed', label: 'Resources', icon: Package },
      { id: 'billing', label: 'Journal', icon: FileText },
    ] : [
      { id: 'entries', label: 'My Supply', icon: Milk },
      { id: 'advances', label: 'My Ledger', icon: Wallet },
      { id: 'feed', label: 'My Stocks', icon: Package },
      { id: 'billing', label: 'My Reports', icon: FileText },
    ]),
    { id: 'about', label: 'About', icon: Info },
  ];

  const isMobile = useIsMobile();

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
                <span className="font-display font-bold text-2xl tracking-tighter text-slate-900 block leading-tight">DairyFlow</span>
                <span className="text-[10px] text-emerald-600 font-black uppercase tracking-[0.2em] block leading-none">Management</span>
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

        <div className="p-6 border-t border-slate-50 space-y-4">
          <button 
            onClick={handleLogout}
            className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all text-rose-500 hover:bg-rose-50 font-bold text-sm ${
              !isSidebarOpen && 'justify-center'
            }`}
          >
            <LogOut size={22} />
            {isSidebarOpen && <span>Sign Out</span>}
          </button>
          
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="w-full flex items-center justify-center p-3 text-slate-300 hover:text-slate-500 hover:bg-slate-50 rounded-xl transition-all"
          >
            <motion.div animate={{ rotate: isSidebarOpen ? 0 : 180 }}>
              {isSidebarOpen ? <X size={20} /> : <ChevronRight size={20} />}
            </motion.div>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto relative glass-card flex flex-col">
        <header className="bg-white/90 backdrop-blur-xl border-b border-slate-100 px-4 py-4 md:px-10 md:py-6 sticky top-0 z-30 flex justify-between items-center shadow-soft">
          <h1 className="text-xl md:text-3xl font-display font-bold text-slate-900 tracking-tight capitalize">
            {activeView.replace('-', ' ')}
          </h1>
          
          <div className="flex items-center gap-6 relative">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-bold text-slate-900 leading-none mb-1">{authData.role === 'admin' ? 'Administrator' : authData.customerName}</p>
              <span className="inline-block px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-black uppercase tracking-wider">
                {authData.role === 'admin' ? 'Owner' : 'Farmer'}
              </span>
            </div>
            <div 
              onClick={() => setIsProfileOpen(!isProfileOpen)}
              className="w-12 h-12 rounded-2xl bg-white border-2 border-slate-100 shadow-soft overflow-hidden p-1 transition-transform hover:scale-105 cursor-pointer relative z-50"
            >
              <img 
                src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${authData.role === 'admin' ? 'dairy' : authData.customerId}`} 
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
                      <p className="font-bold text-slate-900">{authData.role === 'admin' ? 'Administrator' : authData.customerName}</p>
                      <p className="text-xs text-slate-500 font-medium">
                        {authData.role === 'admin' ? 'System Owner' : `Farmer ID: #${authData.customerId}`}
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
                      <button className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-colors">
                        <User size={16} />
                        My Profile
                      </button>
                      <button className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-colors">
                        <Settings size={16} />
                        Account Settings
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
                        Sign Out
                      </button>
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </header>

        <div className="p-4 md:p-10 max-w-7xl mx-auto flex-1 pb-24 md:pb-10">
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
              {activeView === 'billing' && <Billing customerId={authData.role === 'admin' ? undefined : authData.customerId} />}
              {activeView === 'about' && <About />}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      {isMobile && (
        <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-xl border-t border-slate-100 shadow-[0_-4px_24px_rgba(0,0,0,0.06)] safe-area-inset-bottom">
          <div className="flex items-stretch overflow-x-auto">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeView === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveView(item.id as View)}
                  className={`flex-1 min-w-0 flex flex-col items-center justify-center py-2 px-1 transition-all relative ${
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
                  <Icon size={20} className="relative z-10 transition-transform" style={{ transform: isActive ? 'scale(1.15)' : 'scale(1)' }} />
                  <span className={`relative z-10 text-[10px] font-bold mt-0.5 truncate w-full text-center leading-none ${
                    isActive ? 'text-emerald-600' : 'text-slate-400'
                  }`}>{item.label}</span>
                </button>
              );
            })}
            {/* Logout tab on mobile */}
            <button
              onClick={handleLogout}
              className="flex-1 min-w-0 flex flex-col items-center justify-center py-2 px-1 text-rose-400 transition-all"
            >
              <LogOut size={20} />
              <span className="text-[10px] font-bold mt-0.5 truncate w-full text-center leading-none">Logout</span>
            </button>
          </div>
        </nav>
      )}
    </div>
  );
}

