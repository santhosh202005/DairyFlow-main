import React from 'react';
import { motion } from 'motion/react';
import { useTranslation } from '../i18n';

interface LoadingScreenProps {
  message?: string;
  isFadingOut?: boolean;
}

export default function LoadingScreen({ message = 'Loading Dairy Flow...', isFadingOut = false }: LoadingScreenProps) {
  const { t } = useTranslation();
  const displayMessage = message === 'Loading Dairy Flow...' ? t('loadingDairyFlow') : message;

  return (
    <motion.div
      initial={{ opacity: 1 }}
      animate={{ opacity: isFadingOut ? 0 : 1 }}
      transition={{ duration: 0.35, ease: 'easeInOut' }}
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#0f172a] p-6 select-none overflow-hidden"
      style={{ pointerEvents: isFadingOut ? 'none' : 'auto' }}
    >
      {/* Background subtle radial glow matching emerald theme */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 flex flex-col items-center text-center max-w-xs mx-auto">
        {/* Dairy Flow Logo */}
        <motion.div
          initial={{ scale: 0.85, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="relative mb-6"
        >
          {/* Animated pulsing outer halo */}
          <div className="absolute -inset-2.5 rounded-3xl bg-emerald-500/20 blur-md animate-pulse" />
          
          <div className="relative w-28 h-24 sm:w-36 sm:h-28 flex items-center justify-center overflow-visible">
            <div className="absolute -inset-6 rounded-full bg-emerald-400/15 blur-2xl" />
            <img
              src="/new%20dairy%20flow.png"
              alt="Dairy Flow"
              className="relative z-10 max-h-full max-w-full object-contain drop-shadow-[0_8px_20px_rgba(6,78,59,0.45)]"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          </div>
        </motion.div>

        {/* Brand Name */}
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15 }}
          className="mb-6"
        >
          <h1 className="text-2xl sm:text-3xl font-bold font-brand tracking-tight text-white">
            Dairy<span className="text-emerald-400">Flow</span>
          </h1>
          <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-slate-400 mt-0.5">
            {t('dairyManagement')}
          </p>
        </motion.div>

        {/* Modern Animated Spinner */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.25 }}
          className="relative w-12 h-12 flex items-center justify-center mb-4"
        >
          {/* Track ring */}
          <div className="absolute inset-0 rounded-full border-2 border-emerald-500/20" />
          {/* Main spinning gradient arc */}
          <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-emerald-400 border-r-emerald-500 animate-spin" />
          {/* Inner subtle counter-spinning ring */}
          <div
            className="w-6 h-6 rounded-full border-2 border-transparent border-b-emerald-300 animate-spin"
            style={{ animationDirection: 'reverse', animationDuration: '1.2s' }}
          />
        </motion.div>

        {/* Loading text with subtle animated pulse */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.35 }}
          className="text-xs sm:text-sm font-medium tracking-wide text-slate-300 animate-pulse"
        >
          {displayMessage}
        </motion.p>
      </div>

      {/* Footer subtle brand tag */}
      <div className="absolute bottom-6 text-center text-[10px] uppercase font-bold tracking-widest text-slate-600">
        {t('secureReliable')}
      </div>
    </motion.div>
  );
}
