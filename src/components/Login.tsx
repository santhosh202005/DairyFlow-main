import React, { useState } from 'react';
import { Lock, User, LogIn, AlertCircle, Phone, Smartphone, ArrowRight, KeyRound, Eye, EyeOff, Store, CheckCircle2, Mail, MapPin, Send, ClipboardList } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslation } from '../i18n';


interface LoginProps {
  onLogin: (
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
  ) => void;
}

type LoginType = 'customer' | 'admin' | 'vendor' | 'worker';
type ForgotMode = null | 'customer' | 'vendor' | 'worker';

export default function Login({ onLogin }: LoginProps) {
  const { t } = useTranslation();
  const [loginType, setLoginType] = useState<LoginType>('customer');
  const [forgotMode, setForgotMode] = useState<ForgotMode>(null);

  // Login
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Customer forgot (OTP flow)
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [isOtpSent, setIsOtpSent] = useState(false);

  // Vendor/Worker forgot (direct reset)
  const [resetUsername, setResetUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);

  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showAdminTab, setShowAdminTab] = useState(false);
  const [logoClicks, setLogoClicks] = useState(0);

  // Vendor Access Request form
  const [vendorRequestMode, setVendorRequestMode] = useState(false);
  const [vrForm, setVrForm] = useState({ vendor_name: '', address: '', phone: '', email: '', requested_username: '' });
  const [vrSuccess, setVrSuccess] = useState(false);

  React.useEffect(() => {
    setForgotMode(null);
    setIsOtpSent(false);
    setPhone('');
    setOtp('');
    setNewPassword('');
    setConfirmPassword('');
    setError('');
    setMessage('');
    setShowPassword(false);
    setShowNewPassword(false);
    setShowConfirmPassword(false);
    setResetSuccess(false);
    const params = new URLSearchParams(window.location.search);
    if (params.get('admin') === 'true' || params.get('role') === 'admin') {
      setShowAdminTab(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLogoClick = () => {
    const newClicks = logoClicks + 1;
    setLogoClicks(newClicks);
    if (newClicks >= 5) {
      setShowAdminTab(true);
      setMessage("Admin mode activated 🛡️");
      setTimeout(() => setMessage(''), 3000);
    }
  };

  const clearForgot = () => {
    setForgotMode(null);
    setIsOtpSent(false);
    setPhone('');
    setOtp('');
    setResetUsername('');
    setNewPassword('');
    setConfirmPassword('');
    setError('');
    setMessage('');
    setResetSuccess(false);
    setShowNewPassword(false);
    setShowConfirmPassword(false);
  };

  const clearVendorRequest = () => {
    setVendorRequestMode(false);
    setVrForm({ vendor_name: '', address: '', phone: '', email: '', requested_username: '' });
    setVrSuccess(false);
    setError('');
    setMessage('');
  };

  const switchTab = (type: LoginType) => {
    setLoginType(type);
    setUsername('');
    setPassword('');
    setError('');
    setMessage('');
    setShowPassword(false);
    clearForgot();
    clearVendorRequest();
  };

  const handleVendorRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setMessage('');
    try {
      const response = await fetch('/api/vendor-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(vrForm),
      });
      const data = await response.json();
      if (response.ok && data.success) {
        setVrSuccess(true);
        setMessage(data.message || 'Your vendor access request has been submitted!');
      } else {
        setError(data.message || 'Failed to submit request. Please try again.');
      }
    } catch (err) {
      setError(`Something went wrong: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setMessage('');
    try {
      const loginUrl = loginType === 'vendor' ? '/api/vendor/login' : '/api/login';
      const response = await fetch(loginUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await response.json();
      if (response.ok && data.success) {
        onLogin(
          data.token, data.role,
          data.customerId?.toString(), data.customerName, data.defaultRate,
          data.customerPhone, data.customerAddress, data.customerGender,
          data.vendorId?.toString(), data.vendorName, data.vendorPhone, data.vendorAddress,
          data.customerCode, data.profilePicture,
          data.workerId?.toString(), data.workerName, data.workerPhone,
        );
      } else {
        let msg = data.message || 'Invalid credentials. Please try again.';
        if (loginType === 'admin' && username.toLowerCase() === 'admin') {
          msg += ' (Hint: Check if you are using the correct Admin password from settings)';
        }
        setError(msg);
      }
    } catch (err) {
      console.error('[Login.tsx] handleLoginSubmit error:', err);
      setError(`Something went wrong: ${err instanceof Error ? err.message : String(err)}. Please check your connection.`);
    } finally {
      setIsLoading(false);
    }
  };

  // ── Customer forgot: send OTP ──
  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setMessage('');
    try {
      const response = await fetch('/api/request-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });
      const data = await response.json();
      if (response.ok && data.success) {
        setIsOtpSent(true);
        setMessage(data.message || 'OTP sent to your registered mobile number!');
      } else {
        setError(data.message || 'Failed to send OTP. Please make sure the number is registered.');
      }
    } catch (err) {
      console.error('[Login.tsx] handleRequestOtp error:', err);
      setError(`Something went wrong: ${err instanceof Error ? err.message : String(err)}. Please check your connection.`);
    } finally {
      setIsLoading(false);
    }
  };

  // ── Customer forgot: reset with OTP ──
  const handleCustomerReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setMessage('');
    try {
      const response = await fetch('/api/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, otp, newPassword }),
      });
      const data = await response.json();
      if (response.ok && data.success) {
        setResetSuccess(true);
        setMessage('Password reset successfully! You can now log in with your new password.');
        setTimeout(() => { clearForgot(); }, 3000);
      } else {
        setError(data.message || 'Failed to reset password.');
      }
    } catch (err) {
      console.error('[Login.tsx] handleCustomerReset error:', err);
      setError(`Something went wrong: ${err instanceof Error ? err.message : String(err)}. Please check your connection.`);
    } finally {
      setIsLoading(false);
    }
  };

  // ── Vendor / Worker forgot: direct reset ──
  const handleDirectReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (newPassword.length < 4) {
      setError('Password must be at least 4 characters.');
      return;
    }
    setIsLoading(true);
    setError('');
    setMessage('');
    try {
      const response = await fetch('/api/reset-password-direct', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: forgotMode, username: resetUsername, newPassword }),
      });
      const data = await response.json();
      if (response.ok && data.success) {
        setResetSuccess(true);
        setMessage(data.message || 'Password reset successfully!');
        setTimeout(() => { clearForgot(); }, 3000);
      } else {
        setError(data.message || 'Failed to reset password.');
      }
    } catch (err) {
      console.error('[Login.tsx] handleDirectReset error:', err);
      setError(`Something went wrong: ${err instanceof Error ? err.message : String(err)}. Please check your connection.`);
    } finally {
      setIsLoading(false);
    }
  };

  const isForgotPassword = forgotMode !== null;

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden"
      >
        {/* Header */}
        <div className="p-8 bg-emerald-600 text-white text-center">
          <div
            onClick={handleLogoClick}
            className="w-20 h-20 bg-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg overflow-hidden border-2 border-emerald-500/20 cursor-pointer active:scale-95 transition-all select-none"
          >
            <img src="/logo.jpg" alt="DairyFlow Logo" className="w-full h-full object-cover" />
          </div>
          <h2 className="text-2xl font-bold">{t('portalTitle')}</h2>
          <p className="text-emerald-100 text-sm mt-1">
            {vendorRequestMode ? 'Request Vendor Access' : isForgotPassword ? 'Reset Password' : t('signInToYourAccount')}
          </p>
        </div>

        {/* Tab switcher — only on login */}
        {!isForgotPassword && !vendorRequestMode && (
          <div className="flex border-b border-slate-100">
            <button onClick={() => switchTab('customer')}
              className={`flex-1 py-3.5 text-xs font-semibold transition-colors ${loginType === 'customer' ? 'text-emerald-600 border-b-2 border-emerald-600 bg-emerald-50/50' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}>
              🌾 {t('customerLogin')}
            </button>
            <button onClick={() => switchTab('vendor')}
              className={`flex-1 py-3.5 text-xs font-semibold transition-colors ${loginType === 'vendor' ? 'text-emerald-600 border-b-2 border-emerald-600 bg-emerald-50/50' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}>
              🏪 Vendor
            </button>
            <button onClick={() => switchTab('worker')}
              className={`flex-1 py-3.5 text-xs font-semibold transition-colors ${loginType === 'worker' ? 'text-emerald-600 border-b-2 border-emerald-600 bg-emerald-50/50' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}>
              👷 Worker
            </button>
            {showAdminTab && (
              <button onClick={() => switchTab('admin')}
                className={`flex-1 py-3.5 text-xs font-semibold transition-colors ${loginType === 'admin' ? 'text-emerald-600 border-b-2 border-emerald-600 bg-emerald-50/50' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}>
                🛡️ {t('adminLogin')}
              </button>
            )}
          </div>
        )}

        {!isForgotPassword && !vendorRequestMode && (
          <div className="px-6 pt-4 sm:px-8">
            <button
              type="button"
              onClick={() => { setError(''); setMessage(''); setVendorRequestMode(true); }}
              className="w-full flex items-center justify-center gap-2 rounded-xl border border-dashed border-emerald-300 bg-emerald-50/60 px-3 py-3 text-center text-sm font-semibold leading-snug text-emerald-700 transition-all hover:bg-emerald-50"
            >
              <ClipboardList size={16} className="shrink-0" />
              <span>Need a vendor account? Request access from admin</span>
            </button>
          </div>
        )}

        <div className="p-8">
          {/* Error */}
          <AnimatePresence>
            {error && (
              <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                className="bg-red-50 text-red-600 p-4 rounded-xl flex items-center gap-3 text-sm border border-red-100 mb-6">
                <AlertCircle size={18} />
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Success */}
          <AnimatePresence>
            {message && (
              <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                className="bg-emerald-50 text-emerald-700 p-4 rounded-xl flex items-center gap-3 text-sm border border-emerald-100 mb-6">
                {resetSuccess ? <CheckCircle2 size={18} /> : <Smartphone size={18} />}
                {message}
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence mode="wait">
            {/* ──────────────────────────────────────────
                FORGOT PASSWORD — CUSTOMER (OTP flow)
            ────────────────────────────────────────── */}
            {forgotMode === 'customer' && (
              <motion.div key="forgot-customer" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                className="space-y-6">
                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-2xl">🌾</span>
                  <div>
                    <p className="font-bold text-slate-800 text-sm">Customer Password Reset</p>
                    <p className="text-xs text-slate-500">Verify with your registered phone number</p>
                  </div>
                </div>

                {!isOtpSent ? (
                  <form onSubmit={handleRequestOtp} className="space-y-5">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5 flex items-center gap-2">
                        <Phone size={15} /> Registered Phone Number
                      </label>
                      <input required type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
                        placeholder="Enter 10-digit mobile number"
                        className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all" />
                    </div>
                    <button type="submit" disabled={isLoading || !phone}
                      className="w-full bg-emerald-600 text-white py-4 rounded-xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 disabled:opacity-70">
                      {isLoading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <>{t('getOtp')} <ArrowRight size={20} /></>}
                    </button>
                  </form>
                ) : (
                  <form onSubmit={handleCustomerReset} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5 flex items-center gap-2">
                        <KeyRound size={15} /> OTP Code
                      </label>
                      <input required type="text" value={otp} onChange={(e) => setOtp(e.target.value)}
                        placeholder="6-digit OTP" maxLength={6}
                        className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all text-center tracking-widest text-lg font-bold" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5 flex items-center gap-2">
                        <Lock size={15} /> New Password
                      </label>
                      <div className="relative">
                        <input required type={showNewPassword ? 'text' : 'password'} value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)} placeholder="Enter new password"
                          className="w-full p-3 pr-12 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all" />
                        <button type="button" onClick={() => setShowNewPassword(!showNewPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-emerald-600 transition-colors p-1" tabIndex={-1}>
                          {showNewPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                        </button>
                      </div>
                    </div>
                    <button type="submit" disabled={isLoading || otp.length < 4 || !newPassword}
                      className="w-full bg-emerald-600 text-white py-4 rounded-xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 disabled:opacity-70">
                      {isLoading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><KeyRound size={20} /> Reset Password</>}
                    </button>
                  </form>
                )}

                <div className="text-center">
                  <button onClick={clearForgot} className="text-sm text-slate-500 hover:text-emerald-600 font-medium transition-colors">
                    ← Back to Login
                  </button>
                </div>
              </motion.div>
            )}

            {/* ──────────────────────────────────────────
                FORGOT PASSWORD — VENDOR / WORKER (Direct)
            ────────────────────────────────────────── */}
            {(forgotMode === 'vendor' || forgotMode === 'worker') && (
              <motion.div key="forgot-direct" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                className="space-y-5">
                <div className={`flex items-center gap-3 p-3 rounded-xl border ${forgotMode === 'vendor' ? 'bg-emerald-50 border-emerald-100' : 'bg-blue-50 border-blue-100'}`}>
                  <span className="text-2xl">{forgotMode === 'vendor' ? '🏪' : '👷'}</span>
                  <div>
                    <p className="font-bold text-slate-800 text-sm capitalize">{forgotMode} Password Reset</p>
                    <p className="text-xs text-slate-500">Enter your username and set a new password</p>
                  </div>
                </div>

                {resetSuccess ? (
                  <div className="text-center py-6">
                    <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3">
                      <CheckCircle2 size={32} className="text-emerald-600" />
                    </div>
                    <p className="text-emerald-700 font-bold">Password reset successfully!</p>
                    <p className="text-slate-500 text-sm mt-1">Redirecting to login...</p>
                  </div>
                ) : (
                  <form onSubmit={handleDirectReset} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5 flex items-center gap-2">
                        <User size={15} /> {forgotMode === 'vendor' ? 'Vendor' : 'Worker'} Username
                      </label>
                      <input required type="text" value={resetUsername} onChange={(e) => setResetUsername(e.target.value)}
                        placeholder={`Enter your ${forgotMode} username`}
                        className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all" />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5 flex items-center gap-2">
                        <Lock size={15} /> New Password
                      </label>
                      <div className="relative">
                        <input required type={showNewPassword ? 'text' : 'password'} value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)} placeholder="Min. 4 characters"
                          className="w-full p-3 pr-12 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all" />
                        <button type="button" onClick={() => setShowNewPassword(!showNewPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-emerald-600 p-1" tabIndex={-1}>
                          {showNewPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5 flex items-center gap-2">
                        <Lock size={15} /> Confirm New Password
                      </label>
                      <div className="relative">
                        <input required type={showConfirmPassword ? 'text' : 'password'} value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Re-enter new password"
                          className={`w-full p-3 pr-12 rounded-xl border focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all ${
                            confirmPassword && confirmPassword !== newPassword ? 'border-rose-300 focus:border-rose-400' : 'border-slate-200 focus:border-emerald-500'
                          }`} />
                        <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-emerald-600 p-1" tabIndex={-1}>
                          {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                        </button>
                      </div>
                      {confirmPassword && confirmPassword !== newPassword && (
                        <p className="text-xs text-rose-500 mt-1 font-medium">Passwords do not match</p>
                      )}
                    </div>

                    <button type="submit"
                      disabled={isLoading || !resetUsername || !newPassword || newPassword !== confirmPassword}
                      className="w-full bg-emerald-600 text-white py-4 rounded-xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 disabled:opacity-70">
                      {isLoading
                        ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        : <><KeyRound size={20} /> Reset Password</>}
                    </button>
                  </form>
                )}

                <div className="text-center">
                  <button onClick={clearForgot} className="text-sm text-slate-500 hover:text-emerald-600 font-medium transition-colors">
                    ← Back to Login
                  </button>
                </div>
              </motion.div>
            )}

            {/* ──────────────────────────────────────────
                VENDOR ACCESS REQUEST FORM
            ────────────────────────────────────────── */}
            {vendorRequestMode && (
              <motion.div key="vendor-request" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                className="space-y-5">
                <div className="flex items-center gap-3 p-3 bg-emerald-50 border border-emerald-100 rounded-xl">
                  <ClipboardList size={20} className="text-emerald-600 shrink-0" />
                  <div>
                    <p className="font-bold text-slate-800 text-sm">Request Vendor Access</p>
                    <p className="text-xs text-slate-500">Fill in your details — admin will review and notify you via email</p>
                  </div>
                </div>

                {vrSuccess ? (
                  <div className="text-center py-6 space-y-3">
                    <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
                      <CheckCircle2 size={32} className="text-emerald-600" />
                    </div>
                    <p className="text-emerald-700 font-bold">Request Submitted!</p>
                    <p className="text-slate-500 text-sm">The admin will review your request and send an approval email to <strong>{vrForm.email}</strong>.</p>
                    <button onClick={clearVendorRequest} className="text-sm text-emerald-600 hover:text-emerald-700 font-semibold underline underline-offset-2">
                      ← Back to Login
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleVendorRequest} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5 flex items-center gap-2">
                        <Store size={15} /> Vendor / Business Name *
                      </label>
                      <input required type="text" value={vrForm.vendor_name} onChange={e => setVrForm(f => ({ ...f, vendor_name: e.target.value }))}
                        placeholder="e.g. Rajan Dairy Center"
                        className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5 flex items-center gap-2">
                        <User size={15} /> Requested Username *
                      </label>
                      <input required type="text" value={vrForm.requested_username} onChange={e => setVrForm(f => ({ ...f, requested_username: e.target.value }))}
                        placeholder="e.g. rajan_dairy"
                        className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5 flex items-center gap-2">
                        <Mail size={15} /> Email Address *
                      </label>
                      <input required type="email" value={vrForm.email} onChange={e => setVrForm(f => ({ ...f, email: e.target.value }))}
                        placeholder="your@gmail.com"
                        className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5 flex items-center gap-2">
                          <Phone size={15} /> Phone
                        </label>
                        <input type="tel" value={vrForm.phone} onChange={e => setVrForm(f => ({ ...f, phone: e.target.value }))}
                          placeholder="Mobile number"
                          className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5 flex items-center gap-2">
                          <MapPin size={15} /> Address
                        </label>
                        <input type="text" value={vrForm.address} onChange={e => setVrForm(f => ({ ...f, address: e.target.value }))}
                          placeholder="Location"
                          className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all" />
                      </div>
                    </div>
                    <button type="submit" disabled={isLoading}
                      className="w-full bg-emerald-600 text-white py-4 rounded-xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 disabled:opacity-70">
                      {isLoading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><Send size={18} /> Submit Request</>}
                    </button>
                  </form>
                )}

                {!vrSuccess && (
                  <div className="text-center">
                    <button onClick={clearVendorRequest} className="text-sm text-slate-500 hover:text-emerald-600 font-medium transition-colors">
                      ← Back to Login
                    </button>
                  </div>
                )}
              </motion.div>
            )}

            {/* ──────────────────────────────────────────
                NORMAL LOGIN FORM
            ────────────────────────────────────────── */}
            {!isForgotPassword && !vendorRequestMode && (
              <motion.div key="login" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}>
                <form onSubmit={handleLoginSubmit} className="space-y-6">
                  {loginType === 'vendor' && (
                    <div className="space-y-2">
                      <div className="flex items-start gap-3 p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-sm text-emerald-700">
                        <Store size={18} className="shrink-0 mt-0.5 text-emerald-600" />
                        <span>Enter the <strong>username &amp; password</strong> created for your vendor account by the admin.</span>
                      </div>
                    </div>
                  )}
                  {loginType === 'worker' && (
                    <div className="flex items-start gap-3 p-3 bg-blue-50 border border-blue-100 rounded-xl text-sm text-blue-700">
                      <User size={18} className="shrink-0 mt-0.5 text-blue-600" />
                      <span>Enter the <strong>username &amp; password</strong> created for your worker account by the vendor.</span>
                    </div>
                  )}

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-2">
                        <User size={16} /> {t('username')}
                      </label>
                      <input required type="text" value={username} onChange={(e) => setUsername(e.target.value)}
                        placeholder={
                          loginType === 'admin' ? t('enterAdminUsername') :
                          loginType === 'vendor' ? 'Enter your vendor username' :
                          loginType === 'worker' ? 'Enter your worker username' :
                          t('enterCustomerUsername')
                        }
                        className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all" />
                    </div>

                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="block text-sm font-medium text-slate-700 flex items-center gap-2">
                          <Lock size={16} /> {t('password')}
                        </label>
                        {/* Forgot Password link for customer, vendor, worker */}
                        {(loginType === 'customer' || loginType === 'vendor' || loginType === 'worker') && (
                          <button type="button"
                            onClick={() => { setError(''); setMessage(''); setForgotMode(loginType as ForgotMode); }}
                            className="text-xs text-emerald-600 hover:text-emerald-700 font-semibold underline underline-offset-2 transition-colors">
                            Forgot Password?
                          </button>
                        )}
                      </div>
                      <div className="relative">
                        <input required type={showPassword ? 'text' : 'password'} value={password}
                          onChange={(e) => setPassword(e.target.value)} placeholder="••••••••"
                          className="w-full p-3 pr-12 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all" />
                        <button type="button" onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-emerald-600 transition-colors p-1" tabIndex={-1}>
                          {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                        </button>
                      </div>
                    </div>
                  </div>

                  <button type="submit" disabled={isLoading}
                    className="w-full bg-emerald-600 text-white py-4 rounded-xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 disabled:opacity-70">
                    {isLoading
                      ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      : <><LogIn size={20} /> {
                          loginType === 'admin' ? t('signInAsAdmin') :
                          loginType === 'vendor' ? t('signInAsVendor') :
                          loginType === 'worker' ? t('signInAsWorker') :
                          t('signInAsCustomer')
                        }</>}
                  </button>
                </form>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
