import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, QrCode, CreditCard, Banknote, Copy, Check, ExternalLink, ArrowRight, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { useTranslation } from '../i18n';

interface SendMoneyModalProps {
  isOpen: boolean;
  onClose: () => void;
  recipientName: string;
  recipientType: 'customer' | 'worker';
  recipientId: string;
  amount: number;
  bankName?: string;
  accountNumber?: string;
  ifscCode?: string;
  upiId?: string;
  note?: string;
  onPaymentRecorded?: () => void;
}

export default function SendMoneyModal({
  isOpen,
  onClose,
  recipientName,
  recipientType,
  recipientId,
  amount,
  bankName,
  accountNumber,
  ifscCode,
  upiId,
  note = 'DairyFlow Payout',
  onPaymentRecorded,
}: SendMoneyModalProps) {
  const { t, lang } = useTranslation();
  const [activeTab, setActiveTab] = useState<'upi' | 'bank' | 'cash'>('upi');
  const [copied, setCopied] = useState(false);
  const [customUpi, setCustomUpi] = useState(upiId || '');
  const [paymentMode, setPaymentMode] = useState<'upi' | 'bank_transfer' | 'cash'>('upi');
  const [refNo, setRefNo] = useState('');
  const [recording, setRecording] = useState(false);
  const [recordedSuccess, setRecordedSuccess] = useState(false);

  if (!isOpen) return null;

  const effectiveUpi = customUpi || upiId || '';
  const upiLink = effectiveUpi
    ? `upi://pay?pa=${encodeURIComponent(effectiveUpi)}&pn=${encodeURIComponent(recipientName)}&am=${amount}&tn=${encodeURIComponent(note)}`
    : '';

  const qrCodeUrl = effectiveUpi
    ? `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(upiLink)}`
    : '';

  const handleCopyBankDetails = () => {
    const text = `Bank: ${bankName || 'N/A'}\nAccount No: ${accountNumber || 'N/A'}\nIFSC: ${ifscCode || 'N/A'}\nUPI ID: ${effectiveUpi || 'N/A'}\nName: ${recipientName}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleRecordPayment = async () => {
    setRecording(true);
    try {
      const token = localStorage.getItem('dairy_auth_token');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers.Authorization = `Bearer ${token}`;

      const today = new Date().toISOString().split('T')[0];
      const res = await fetch('/api/payments', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          recipient_type: recipientType,
          recipient_id: recipientId,
          amount,
          payment_mode: paymentMode,
          reference_no: refNo || null,
          date: today,
          note,
        }),
      });

      if (res.ok) {
        setRecordedSuccess(true);
        if (onPaymentRecorded) onPaymentRecorded();
        setTimeout(() => {
          setRecordedSuccess(false);
          onClose();
        }, 2000);
      }
    } catch (err) {
      console.error('Payment record error:', err);
    } finally {
      setRecording(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="bg-slate-900 text-white p-6 relative overflow-hidden">
            <div className="absolute -right-8 -top-8 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl" />
            <div className="flex justify-between items-start relative z-10">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400">Send Payout</p>
                <h3 className="text-xl font-display font-bold text-white mt-0.5">{recipientName}</h3>
                <p className="text-xs text-slate-400 mt-1 capitalize">{recipientType === 'customer' ? 'Farmer Milk Earnings' : 'Worker Monthly Salary'}</p>
              </div>
              <button
                onClick={onClose}
                className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-slate-300 hover:text-white hover:bg-white/20 transition-all touch-btn"
              >
                <X size={18} />
              </button>
            </div>

            {/* Amount Banner */}
            <div className="mt-4 pt-4 border-t border-white/10 flex justify-between items-baseline">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-widest">Payout Amount</span>
              <span className="text-3xl font-display font-black text-emerald-400">₹{amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
            </div>
          </div>

          {/* Payment Method Selector Tabs */}
          <div className="grid grid-cols-3 p-2 bg-slate-100 gap-1.5 border-b border-slate-100">
            <button
              onClick={() => setActiveTab('upi')}
              className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 touch-btn ${
                activeTab === 'upi' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <QrCode size={14} /> UPI / App
            </button>
            <button
              onClick={() => setActiveTab('bank')}
              className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 touch-btn ${
                activeTab === 'bank' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <CreditCard size={14} /> Bank Transfer
            </button>
            <button
              onClick={() => setActiveTab('cash')}
              className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 touch-btn ${
                activeTab === 'cash' ? 'bg-white text-amber-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Banknote size={14} /> Cash / Record
            </button>
          </div>

          {/* Body */}
          <div className="p-6 overflow-y-auto flex-1 space-y-4">
            {recordedSuccess ? (
              <div className="py-12 text-center space-y-3">
                <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle2 size={32} />
                </div>
                <h4 className="text-lg font-bold text-slate-900">Payment Recorded!</h4>
                <p className="text-xs text-slate-500">₹{amount} paid to {recipientName} has been saved.</p>
              </div>
            ) : activeTab === 'upi' ? (
              <div className="space-y-4 text-center">
                {effectiveUpi ? (
                  <>
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex flex-col items-center">
                      <img src={qrCodeUrl} alt="UPI QR Code" className="w-44 h-44 rounded-xl shadow-sm border border-slate-200" />
                      <p className="text-xs font-bold text-slate-700 mt-3 flex items-center gap-1.5">
                        <ShieldCheck size={14} className="text-emerald-600" /> {effectiveUpi}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-0.5">Scan with GPay, PhonePe, Paytm, or BHIM</p>
                    </div>

                    <a
                      href={upiLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full inline-flex items-center justify-center gap-2 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold text-sm shadow-lg shadow-emerald-600/20 transition-all touch-btn"
                    >
                      <ExternalLink size={16} /> Open GPay / PhonePe / Paytm
                    </a>
                  </>
                ) : (
                  <div className="space-y-3 text-left">
                    <p className="text-xs text-slate-500 font-medium">No UPI ID saved for {recipientName}. Enter a UPI ID below to pay or generate a QR code:</p>
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-600 uppercase">Enter UPI ID</label>
                      <input
                        type="text"
                        value={customUpi}
                        onChange={(e) => setCustomUpi(e.target.value)}
                        placeholder="e.g. 9876543210@ybl or name@upi"
                        className="input-base text-xs"
                      />
                    </div>
                  </div>
                )}
              </div>
            ) : activeTab === 'bank' ? (
              <div className="space-y-4">
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-3">
                  <div className="flex justify-between items-center pb-2 border-b border-slate-200/60">
                    <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Bank Name</span>
                    <span className="text-sm font-bold text-slate-800">{bankName || 'Not provided'}</span>
                  </div>
                  <div className="flex justify-between items-center pb-2 border-b border-slate-200/60">
                    <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Account Number</span>
                    <span className="text-sm font-mono font-bold text-slate-900">{accountNumber || 'Not provided'}</span>
                  </div>
                  <div className="flex justify-between items-center pb-2 border-b border-slate-200/60">
                    <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">IFSC Code</span>
                    <span className="text-sm font-mono font-bold text-blue-700 uppercase">{ifscCode || 'Not provided'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">UPI ID</span>
                    <span className="text-sm font-bold text-emerald-700">{effectiveUpi || 'Not provided'}</span>
                  </div>
                </div>

                <button
                  onClick={handleCopyBankDetails}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-blue-50 text-blue-700 border border-blue-100 hover:bg-blue-100 rounded-2xl font-bold text-xs transition-all touch-btn"
                >
                  {copied ? <Check size={16} className="text-emerald-600" /> : <Copy size={15} />}
                  {copied ? 'Copied to Clipboard!' : 'Copy Bank & UPI Details'}
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-slate-500 font-medium">Record this payment directly into the ledger / payout history:</p>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-slate-600 uppercase">Payment Mode</label>
                  <select
                    value={paymentMode}
                    onChange={(e) => setPaymentMode(e.target.value as any)}
                    className="input-base text-xs"
                  >
                    <option value="cash">💵 Cash Payment</option>
                    <option value="upi">📱 UPI App (GPay/PhonePe)</option>
                    <option value="bank_transfer">🏦 Bank Transfer (NEFT/IMPS)</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-slate-600 uppercase">Reference / Transaction No. (Optional)</label>
                  <input
                    type="text"
                    value={refNo}
                    onChange={(e) => setRefNo(e.target.value)}
                    placeholder="e.g. UPI Ref # or Cheque No."
                    className="input-base text-xs"
                  />
                </div>
                <button
                  onClick={handleRecordPayment}
                  disabled={recording}
                  className="w-full flex items-center justify-center gap-2 py-3.5 bg-slate-900 text-white hover:bg-slate-800 rounded-2xl font-bold text-xs transition-all touch-btn mt-4 shadow-md"
                >
                  {recording ? 'Recording...' : 'Mark as Paid & Save'}
                </button>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
