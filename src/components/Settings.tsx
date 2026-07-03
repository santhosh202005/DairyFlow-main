import { useState } from 'react';
import { User, FileText, Info, LogOut, Phone, MapPin, Settings as SettingsIcon, Shield } from 'lucide-react';
import { motion } from 'motion/react';
import Billing from './Billing';
import About from './About';
import ContactUs from './ContactUs';
import { getStoredLanguage, setStoredLanguage } from '../auth';
import { useTranslation } from '../i18n';

interface SettingsProps {
  authData: {
    role: string | null;
    customerId?: string;
    customerName?: string;
    defaultRate?: number;
    customerPhone?: string;
    customerAddress?: string;
    customerGender?: 'male' | 'female';
  };
  onLogout: () => void;
}

type TabType = 'profile' | 'reports' | 'about' | 'contact' | 'logout';

export default function Settings({ authData, onLogout }: SettingsProps) {
  const [activeTab, setActiveTab] = useState<TabType>('profile');
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [language, setLanguage] = useState<string>(() => getStoredLanguage() || 'en');
  const { t, setLang } = useTranslation();

  const tabs = [
    { id: 'profile' as TabType, label: t('profileInfo'), icon: User },
    { id: 'reports' as TabType, label: authData.role === 'admin' ? t('reports') : 'My Reports', icon: FileText },
    { id: 'about' as TabType, label: t('about'), icon: Info },
    { id: 'contact' as TabType, label: 'Contact Us', icon: Phone },
    { id: 'logout' as TabType, label: t('signOut'), icon: LogOut, className: 'text-rose-500 hover:bg-rose-50' },
  ];

  return (
    <div className="flex flex-col lg:flex-row gap-8 items-start min-h-[600px]">
      {/* Settings Navigation Sidebar */}
      <aside className="w-full lg:w-80 bg-white border border-slate-100 rounded-3xl p-6 shadow-soft flex flex-col gap-2 shrink-0">
          <div className="px-4 py-3 mb-4 border-b border-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <SettingsIcon size={20} />
            </div>
            <div>
              <h3 className="font-display font-bold text-slate-900 leading-tight">{t('account')}</h3>
              <p className="text-xs text-slate-400 font-medium">{t('controlCenter')}</p>
            </div>
          </div>
        </div>

        <nav className="flex flex-row lg:flex-col overflow-x-auto lg:overflow-visible gap-1.5 pb-2 lg:pb-0 scrollbar-none">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  if (tab.id === 'logout') {
                    setActiveTab('logout');
                    setShowLogoutConfirm(true);
                  } else {
                    setActiveTab(tab.id);
                    setShowLogoutConfirm(false);
                  }
                }}
                className={`flex items-center gap-3 px-4 py-3.5 rounded-2xl font-bold text-sm transition-all whitespace-nowrap lg:w-full relative group cursor-pointer ${
                  tab.id === 'logout' && !isActive
                    ? 'text-rose-500 hover:bg-rose-50/60'
                    : isActive
                    ? tab.id === 'logout'
                      ? 'bg-rose-600 text-white shadow-lg shadow-rose-100'
                      : 'bg-emerald-600 text-white shadow-lg shadow-emerald-100'
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                }`}
              >
                <Icon size={18} className={isActive ? 'text-white' : 'group-hover:scale-110 transition-transform'} />
                <span>{tab.label}</span>
                {isActive && (
                  <motion.div
                    layoutId="active-settings-tab"
                    className="absolute right-3 w-1.5 h-1.5 bg-white rounded-full hidden lg:block"
                  />
                )}
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Settings Main Content Area */}
      <main className="flex-1 w-full bg-transparent">
        <div className="min-h-full">
          {/* Profile Tab */}
          {activeTab === 'profile' && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              {/* Profile Card Header */}
              <div className="bg-white rounded-3xl border border-slate-100 p-8 shadow-soft relative overflow-hidden">
                <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-50 rounded-full blur-3xl -mr-32 -mt-32 opacity-40 pointer-events-none" />
                <div className="relative z-10 flex flex-col sm:flex-row gap-6 items-center">
                  <div className="w-24 h-24 rounded-2xl bg-white border-2 border-slate-100 shadow-soft overflow-hidden p-1.5 shrink-0">
                    <img
                      src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${authData.role === 'admin' ? 'dairy' : authData.customerId}&gender=${authData.customerGender || 'male'}`}
                      alt="User Avatar"
                      className="w-full h-full rounded-xl object-cover"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <div className="text-center sm:text-left flex-1 space-y-2">
                    <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3">
                      <h2 className="text-3xl font-display font-bold text-slate-900 tracking-tight leading-none">
                        {authData.role === 'admin' ? t('administrator') : authData.customerName}
                      </h2>
                      <span className={`inline-block px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider ${
                        authData.role === 'admin' 
                          ? 'bg-purple-100 text-purple-700' 
                          : 'bg-emerald-100 text-emerald-700'
                      }`}>
                        {authData.role === 'admin' ? t('ownerAdmin') : t('registeredFarmer')}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-slate-400">
                      {authData.role === 'admin' ? t('systemManagementAuthority') : `Farmer Identification Number: #F-${authData.customerId}`}
                    </p>
                  </div>
                </div>
              </div>

              {/* Account Details Details Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white rounded-3xl border border-slate-100 p-8 shadow-soft space-y-6">
                  <h3 className="text-lg font-display font-bold text-slate-900 border-b border-slate-50 pb-3 flex items-center gap-2">
                    <User size={18} className="text-emerald-500" />
                    {t('personalInformationLabel')}
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{t('fullName')}</p>
                      <p className="text-sm font-bold text-slate-800">{authData.role === 'admin' ? 'DairyFlow Admin' : authData.customerName}</p>
                    </div>
                    {authData.role !== 'admin' && (
                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{t('farmerAccountId')}</p>
                        <p className="text-sm font-mono font-bold text-slate-800">F-{authData.customerId}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{t('contactPhone')}</p>
                      <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
                        <Phone size={14} className="text-slate-400" />
                        <span>{authData.customerPhone || 'Not Provided'}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-3xl border border-slate-100 p-8 shadow-soft space-y-6">
                  <h3 className="text-lg font-display font-bold text-slate-900 border-b border-slate-50 pb-3 flex items-center gap-2">
                    <Shield size={18} className="text-emerald-500" />
                    {t('businessParameters')}
                  </h3>
                  <div className="space-y-4">
                    {authData.role !== 'admin' && (
                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{t('assignedMilkPriceRate')}</p>
                        <p className="text-xl font-display font-bold text-emerald-600">₹{authData.defaultRate?.toFixed(2)} / Litre</p>
                        <p className="text-[9px] text-slate-400 font-bold mt-1 uppercase">{t('standardQualityMultiplier')}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{t('registeredAddress')}</p>
                      <div className="flex items-start gap-2 text-sm font-bold text-slate-800">
                        <MapPin size={14} className="text-slate-400 mt-0.5 shrink-0" />
                        <span className="leading-relaxed">{authData.customerAddress || t('noAddressProvided')}</span>
                      </div>
                    </div>

                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{t('appLanguage')}</p>
                      <div className="mt-1">
                        <select
                          value={language}
                          onChange={(e) => {
                            const v = e.target.value as 'en' | 'ta';
                            setLanguage(v);
                            setStoredLanguage(v);
                            setLang(v);
                          }}
                          className="input-base"
                        >
                          <option value="en">English</option>
                          <option value="ta">தமிழ் (Tamil)</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Reports Tab */}
          {activeTab === 'reports' && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Billing customerId={authData.role === 'admin' ? undefined : authData.customerId} />
            </motion.div>
          )}

          {/* About Tab */}
          {activeTab === 'about' && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-3xl border border-slate-100 p-2 md:p-6 shadow-soft"
            >
              <About />
            </motion.div>
          )}

          {/* Contact Tab */}
          {activeTab === 'contact' && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-3xl border border-slate-100 p-2 md:p-6 shadow-soft"
            >
              <ContactUs />
            </motion.div>
          )}


          {/* Logout Tab (Confirmation dialog) */}
          {activeTab === 'logout' && showLogoutConfirm && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white rounded-3xl border border-slate-100 p-8 shadow-soft max-w-xl mx-auto text-center space-y-6"
            >
              <div className="w-16 h-16 bg-rose-50 text-rose-500 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
                <LogOut size={28} />
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-display font-bold text-slate-900">Are you sure you want to sign out?</h3>
                <p className="text-sm text-slate-400 font-medium">
                  {t('reAuthenticateMessage')}
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 pt-4">
                <button
                  onClick={() => {
                    setActiveTab('profile');
                    setShowLogoutConfirm(false);
                  }}
                  className="flex-1 py-3 px-6 rounded-xl border border-slate-100 hover:bg-slate-50 font-bold text-sm text-slate-600 transition-colors cursor-pointer"
                >
                  {t('cancelKeepActive')}
                </button>
                <button
                  onClick={onLogout}
                  className="flex-1 py-3 px-6 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm transition-colors shadow-lg shadow-rose-100 cursor-pointer"
                >
                  {t('confirmSignOut')}
                </button>
              </div>
            </motion.div>
          )}
        </div>
      </main>
    </div>
  );
}
