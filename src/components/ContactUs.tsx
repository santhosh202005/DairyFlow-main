import React, { useMemo, useState } from 'react';
import { Phone, MapPin, ShieldCheck, Building2, Copy, Check, Map } from 'lucide-react';
import { motion } from 'motion/react';
import { useTranslation } from '../i18n';

type PhoneNumber = {
  label: string;
  number: string;
};

const business = {
  name: 'Dairy Flow',
  since: 'Since 1970',
  admin: 'Rajini',
  phones: [
    { label: 'Mobile 1', number: '+91 9042141951' },
    { label: 'Mobile 2', number: '+91 9047261367' },
  ] as PhoneNumber[],
  address:
    'No. 16, Kannadiyar Street,\nKarungalikuppam,\nRanipet District – 632507,\nTamil Nadu, India.',
};

function normalizePhoneForTel(phone: string) {
  return phone.replace(/[^\d+]/g, '');
}

export default function ContactUs() {
  const { t } = useTranslation();
  const [copied, setCopied] = useState<string | null>(null);



  const onCopy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(value);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      // ignore
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-2"
      >
        <h2 className="page-title">Contact Us</h2>
        <p className="text-slate-500 text-sm md:text-base">
          Reach out to Dairy Flow — call, copy numbers, or find us on the map.
        </p>
      </motion.div>

      <div className="bg-white rounded-[2rem] md:rounded-[3rem] shadow-soft border border-slate-100 overflow-hidden">
        <div className="p-5 md:p-10">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 md:gap-6">
            <div className="md:col-span-2">
              <div className="bg-slate-50/70 border border-slate-100 rounded-[1.5rem] p-5 md:p-6 space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                    <Building2 size={20} />
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.2em] font-black text-slate-400">
                      Business Name
                    </p>
                    <p className="text-lg md:text-xl font-display font-bold text-slate-900">{business.name}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                    <ShieldCheck size={20} />
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.2em] font-black text-slate-400">Administrator</p>
                    <p className="text-lg md:text-xl font-display font-bold text-slate-900">{business.admin}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                    <span className="text-lg font-black">⏳</span>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.2em] font-black text-slate-400">Since</p>
                    <p className="text-lg md:text-xl font-display font-bold text-slate-900">{business.since}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="md:col-span-3 space-y-4 md:space-y-6">
              <div className="bg-white rounded-[1.5rem] border border-slate-100 p-5 md:p-6">
                <div className="flex items-center gap-2 mb-3">
                  <Phone size={18} className="text-emerald-600" />
                  <h3 className="font-display font-bold text-slate-900">Mobile Numbers</h3>
                </div>

                <div className="space-y-3">
                  {business.phones.map((p) => {
                    const tel = normalizePhoneForTel(p.number);
                    const isCopied = copied === p.number;
                    return (
                      <div
                        key={p.number}
                        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 rounded-2xl border border-slate-100 bg-slate-50/40"
                      >
                        <div className="min-w-0">
                          <p className="text-[10px] uppercase tracking-[0.2em] font-black text-slate-400">{p.label}</p>
                          <a
                            href={`tel:${tel}`}
                            className="block mt-1 font-display font-bold text-slate-900 text-lg hover:text-emerald-700 break-all"
                          >
                            {p.number}
                          </a>
                        </div>

                        <div className="flex items-center gap-2">
                          <a
                            href={`tel:${tel}`}
                            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white font-bold text-sm hover:bg-emerald-700 transition-all shadow-sm touch-btn"
                          >
                            <Phone size={16} /> Call Now
                          </a>

                          <button
                            type="button"
                            onClick={() => onCopy(p.number)}
                            className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 font-bold text-sm hover:bg-slate-50 transition-colors touch-btn"
                            aria-label={`Copy ${p.number}`}
                          >
                            {isCopied ? <Check size={16} className="text-emerald-600" /> : <Copy size={16} className="text-slate-500" />}
                            {isCopied ? 'Copied' : 'Copy'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="bg-white rounded-[1.5rem] border border-slate-100 p-5 md:p-6">
                <div className="flex items-center gap-2 mb-3">
                  <MapPin size={18} className="text-indigo-600" />
                  <h3 className="font-display font-bold text-slate-900">Address</h3>
                </div>

                <div className="text-slate-700 font-medium whitespace-pre-line leading-relaxed">{business.address}</div>


              </div>
            </div>
          </div>
        </div>
      </div>

      <footer className="text-center text-slate-400 text-sm pb-2">
        © Since 1970 | Dairy Flow | All Rights Reserved
      </footer>
    </div>
  );
}

