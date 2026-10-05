import { motion } from 'motion/react';

interface UpdateAvailableModalProps {
  currentVersion: string;
  newVersion: string;
  onCancel: () => void;
}

const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.dairyflow.app';

export default function UpdateAvailableModal({ currentVersion, newVersion, onCancel }: UpdateAvailableModalProps) {
  const openPlayStore = () => {
    window.location.href = PLAY_STORE_URL;
  };

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.22, ease: 'easeOut' }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="update-available-title"
        className="w-full max-w-md overflow-hidden rounded-[1.75rem] border border-white/70 bg-white shadow-2xl"
      >
        <div className="bg-gradient-to-br from-emerald-600 to-teal-700 px-6 pb-6 pt-7 text-center text-white sm:px-8">
          <div className="relative mx-auto mb-4 flex h-24 w-32 items-center justify-center overflow-visible">
            <div className="absolute -inset-5 rounded-full bg-emerald-300/20 blur-2xl" />
            <img src="/new%20dairy%20flow.png" alt="Dairy Flow" className="relative z-10 max-h-full max-w-full object-contain drop-shadow-[0_8px_18px_rgba(6,78,59,0.28)]" />
          </div>
          <h2 id="update-available-title" className="font-display text-2xl font-bold">Update Available</h2>
          <p className="mt-1 text-sm font-medium text-emerald-50">A better Dairy Flow is ready.</p>
        </div>

        <div className="space-y-5 px-6 py-6 sm:px-8">
          <p className="text-center text-sm leading-6 text-slate-600">
            A new version of Dairy Flow is available. Please update the app to get the latest features, improvements, and bug fixes.
          </p>

          <div className="grid grid-cols-2 gap-3 rounded-2xl bg-slate-50 p-4 text-center">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Current Version</p>
              <p className="mt-1 font-display text-lg font-bold text-slate-800">{currentVersion}</p>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600">New Version</p>
              <p className="mt-1 font-display text-lg font-bold text-emerald-700">{newVersion}</p>
            </div>
          </div>

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onCancel}
              className="min-h-12 flex-1 rounded-xl border border-slate-200 px-5 py-3 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-50 sm:flex-none"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={openPlayStore}
              className="min-h-12 flex-1 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-200 transition-colors hover:bg-emerald-700 sm:flex-none"
            >
              OK
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
