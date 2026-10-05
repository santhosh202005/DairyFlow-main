import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { WifiOff, RefreshCw, AlertCircle } from 'lucide-react';
import { useTranslation } from '../i18n';

interface NetworkStatusModalProps {
  onRetry?: () => void;
  isBackendUnreachable?: boolean;
}

export default function NetworkStatusModal({ onRetry, isBackendUnreachable = false }: NetworkStatusModalProps) {
  const { t } = useTranslation();
  const [isOnline, setIsOnline] = useState(() => (typeof navigator !== 'undefined' ? navigator.onLine : true));
  const [backendUnavailable, setBackendUnavailable] = useState(isBackendUnreachable);
  const [isChecking, setIsChecking] = useState(false);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    const handleBackendUnavailable = () => setBackendUnavailable(true);
    const handleBackendRestored = () => setBackendUnavailable(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('dairyflow:backend-unreachable', handleBackendUnavailable);
    window.addEventListener('dairyflow:backend-restored', handleBackendRestored);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('dairyflow:backend-unreachable', handleBackendUnavailable);
      window.removeEventListener('dairyflow:backend-restored', handleBackendRestored);
    };
  }, []);

  const handleManualRetry = async () => {
    setIsChecking(true);
    try {
      // Ping backend health
      const res = await fetch('/api/health', { cache: 'no-store' });
      if (res.ok) {
        setIsOnline(true);
        setBackendUnavailable(false);
        if (onRetry) onRetry();
      } else {
        setBackendUnavailable(true);
        if (onRetry) onRetry();
      }
    } catch {
      // Still unreachable or offline
      setBackendUnavailable(true);
      if (navigator.onLine) {
        setIsOnline(true); // browser is online, but backend might still be starting
      }
      if (onRetry) onRetry();
    } finally {
      setTimeout(() => setIsChecking(false), 500);
    }
  };

  const showModal = !isOnline || backendUnavailable || isBackendUnreachable;

  return (
    <AnimatePresence>
      {showModal && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md"
        >
          <motion.div
            initial={{ scale: 0.92, opacity: 0, y: 16 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.92, opacity: 0, y: 16 }}
            transition={{ type: 'spring', stiffness: 350, damping: 25 }}
            className="w-full max-w-sm bg-white rounded-3xl p-6 md:p-8 text-center shadow-2xl border border-slate-100"
          >
            {/* Icon container */}
            <div className="w-16 h-16 rounded-2xl bg-rose-50 text-rose-500 border border-rose-100 flex items-center justify-center mx-auto mb-5 shadow-inner">
              <WifiOff size={30} />
            </div>

            {/* Title and Subtitle */}
            <h3 className="text-xl font-display font-bold text-slate-900 mb-2">
              {t('noInternetConnection')}
            </h3>
            <p className="text-sm text-slate-500 font-medium leading-relaxed mb-6">
              {t('checkInternetConnection')}
            </p>

            {/* Retry Button */}
            <button
              type="button"
              disabled={isChecking}
              onClick={handleManualRetry}
              className="w-full py-3.5 px-5 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] disabled:opacity-70 text-white rounded-2xl font-bold text-sm shadow-lg shadow-emerald-200 transition-all flex items-center justify-center gap-2 touch-btn"
            >
              <RefreshCw size={16} className={isChecking ? 'animate-spin' : ''} />
              <span>{isChecking ? t('checkingConnection') : t('retry')}</span>
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
