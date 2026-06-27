import React, { useState } from 'react';
import { Lock, User, LogIn, AlertCircle, Phone, Smartphone, ArrowRight, KeyRound } from 'lucide-react';
import { motion } from 'motion/react';

interface LoginProps {
  onLogin: (token: string, role: string, customerId?: string, customerName?: string, defaultRate?: number, customerPhone?: string, customerAddress?: string) => void;
}

export default function Login({ onLogin }: LoginProps) {
  const [loginType, setLoginType] = useState<'customer' | 'admin'>('customer');
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  
  // Login credentials (used for both customer and admin)
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  
  // Forgot Password / Reset Password states
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [isOtpSent, setIsOtpSent] = useState(false);

  // Mount-time guard: prevent OTP/forgot UI from showing due to any stale in-memory state.
  // OTP can only appear after the user explicitly clicks “Forgot Password?”.
  React.useEffect(() => {
    setIsForgotPassword(false);
    setIsOtpSent(false);
    setPhone('');
    setOtp('');
    setNewPassword('');
    setError('');
    setMessage('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setMessage('');

    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        onLogin(data.token, data.role, data.customerId, data.customerName, data.defaultRate, data.customerPhone, data.customerAddress);
      } else {
        let msg = data.message || 'Invalid credentials. Please try again.';
        if (loginType === 'admin' && username.toLowerCase() === 'admin') {
          msg += ' (Hint: Check if you are using the correct Admin password from settings)';
        }
        setError(msg);
      }
    } catch (err) {
      setError('Something went wrong. Please check your connection.');
    } finally {
      setIsLoading(false);
    }
  };

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
        setMessage('OTP has been sent to your phone number! (Check server console for test OTP)');
      } else {
        setError(data.message || 'Failed to send OTP. Please make sure the number is registered.');
      }
    } catch (err) {
      setError('Something went wrong. Please check your connection.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
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
        setMessage('Password reset successfully! You can now log in with your new password.');
        setIsForgotPassword(false);
        setIsOtpSent(false);
        setPhone('');
        setOtp('');
        setNewPassword('');
        setUsername('');
        setPassword('');
      } else {
        setError(data.message || 'Failed to reset password.');
      }
    } catch (err) {
      setError('Something went wrong. Please check your connection.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden"
      >
        <div className="p-8 bg-emerald-600 text-white text-center">
          <div className="w-20 h-20 bg-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg overflow-hidden border-2 border-emerald-500/20">
            <img src="/logo.jpg" alt="DairyFlow Logo" className="w-full h-full object-cover" />
          </div>
          <h2 className="text-2xl font-bold">DairyFlow Portal</h2>
          <p className="text-emerald-100 text-sm mt-1">
            {isForgotPassword ? 'Reset Password' : 'Sign in to your account'}
          </p>
        </div>

        {!isForgotPassword && (
          <div className="flex border-b border-slate-100">
            <button
              onClick={() => { setLoginType('customer'); setUsername(''); setPassword(''); setError(''); setMessage(''); }}
              className={`flex-1 py-4 text-sm font-medium transition-colors ${loginType === 'customer' ? 'text-emerald-600 border-b-2 border-emerald-600 bg-emerald-50/50' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
            >
              Customer Login
            </button>
            <button
              onClick={() => { setLoginType('admin'); setUsername(''); setPassword(''); setError(''); setMessage(''); }}
              className={`flex-1 py-4 text-sm font-medium transition-colors ${loginType === 'admin' ? 'text-emerald-600 border-b-2 border-emerald-600 bg-emerald-50/50' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
            >
              Admin Login
            </button>
          </div>
        )}

        <div className="p-8">
          {error && (
            <motion.div 
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-red-50 text-red-600 p-4 rounded-xl flex items-center gap-3 text-sm border border-red-100 mb-6"
            >
              <AlertCircle size={18} />
              {error}
            </motion.div>
          )}

          {message && (
            <motion.div 
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-emerald-50 text-emerald-700 p-4 rounded-xl flex items-center gap-3 text-sm border border-emerald-100 mb-6"
            >
              <Smartphone size={18} />
              {message}
            </motion.div>
          )}

          {isForgotPassword ? (
            <div className="space-y-6">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <KeyRound size={20} className="text-emerald-600" />
                Forgot Password
              </h3>

              {!isOtpSent ? (
                <form onSubmit={handleRequestOtp} className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-2">
                      <Phone size={16} /> Phone Number
                    </label>
                    <input
                      required
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="Enter registered phone number"
                      className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                    />
                  </div>
                  
                  <button
                    type="submit"
                    disabled={isLoading || !phone}
                    className="w-full bg-emerald-600 text-white py-4 rounded-xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 disabled:opacity-70"
                  >
                    {isLoading ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        Get OTP
                        <ArrowRight size={20} />
                      </>
                    )}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleResetPassword} className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-2">
                      <Lock size={16} /> Enter OTP
                    </label>
                    <input
                      required
                      type="text"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
                      placeholder="6-digit OTP"
                      maxLength={6}
                      className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all text-center tracking-widest text-lg font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-2">
                      <Lock size={16} /> New Password
                    </label>
                    <input
                      required
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Enter new password"
                      className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                    />
                  </div>
                  
                  <button
                    type="submit"
                    disabled={isLoading || otp.length < 4 || !newPassword}
                    className="w-full bg-emerald-600 text-white py-4 rounded-xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 disabled:opacity-70"
                  >
                    {isLoading ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <KeyRound size={20} />
                        Reset Password
                      </>
                    )}
                  </button>
                </form>
              )}

              <div className="text-center mt-4">
                <button
                  onClick={() => { setIsForgotPassword(false); setIsOtpSent(false); setPhone(''); setOtp(''); setNewPassword(''); setError(''); setMessage(''); }}
                  className="text-sm text-slate-500 hover:text-emerald-600 font-medium transition-colors"
                >
                  Back to Login
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleLoginSubmit} className="space-y-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-2">
                    <User size={16} /> Username
                  </label>
                  <input
                    required
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder={loginType === 'admin' ? "Enter admin username" : "Enter customer username"}
                    className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-sm font-medium text-slate-700 flex items-center gap-2">
                      <Lock size={16} /> Password
                    </label>
                    {loginType === 'customer' && (
                      <button
                        type="button"
                        onClick={() => { setIsForgotPassword(true); setError(''); setMessage(''); }}
                        className="text-xs text-emerald-600 hover:text-emerald-700 font-medium"
                      >
                        Forgot Password?
                      </button>
                    )}
                  </div>
                  <input
                    required
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-emerald-600 text-white py-4 rounded-xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 disabled:opacity-70"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <LogIn size={20} />
                    Sign In as {loginType === 'admin' ? 'Admin' : 'Customer'}
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </motion.div>
    </div>
  );
}
