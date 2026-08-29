import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  QrCode, 
  CreditCard, 
  Banknote, 
  Copy, 
  Check, 
  ExternalLink, 
  ShieldCheck, 
  CheckCircle2, 
  Sparkles, 
  Smartphone, 
  Share2 
} from 'lucide-react';
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
  phone?: string;
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
  phone,
  note = 'DairyFlow Payout',
  onPaymentRecorded,
}: SendMoneyModalProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'upi' | 'bank' | 'cash'>('upi');
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedUpiId, setCopiedUpiId] = useState(false);
  const [copiedBank, setCopiedBank] = useState(false);
  const [customUpi, setCustomUpi] = useState(upiId || '');
  const [paymentMode, setPaymentMode] = useState<'upi' | 'bank_transfer' | 'cash'>('upi');
  const [refNo, setRefNo] = useState('');
  const [recording, setRecording] = useState(false);
  const [recordedSuccess, setRecordedSuccess] = useState(false);

  if (!isOpen) return null;

  // Derive effective UPI ID
  const effectiveUpi = customUpi || upiId || '';
  
  // UPI Deep link compliant with standard Indian UPI URI specification
  const formattedAmount = Math.max(0, amount).toFixed(2);
  const cleanNote = note || 'DairyFlow Milk Payout';
  const upiLink = effectiveUpi
    ? `upi://pay?pa=${encodeURIComponent(effectiveUpi.trim())}&pn=${encodeURIComponent(recipientName)}&am=${formattedAmount}&cu=INR&tn=${encodeURIComponent(cleanNote)}`
    : '';

  // App-specific intent URIs for mobile devices
  const gpayLink = upiLink ? `tez://upi/pay?pa=${encodeURIComponent(effectiveUpi.trim())}&pn=${encodeURIComponent(recipientName)}&am=${formattedAmount}&cu=INR&tn=${encodeURIComponent(cleanNote)}` : '';
  const phonePeLink = upiLink ? `phonepe://pay?pa=${encodeURIComponent(effectiveUpi.trim())}&pn=${encodeURIComponent(recipientName)}&am=${formattedAmount}&cu=INR&tn=${encodeURIComponent(cleanNote)}` : '';
  const paytmLink = upiLink ? `paytmmp://pay?pa=${encodeURIComponent(effectiveUpi.trim())}&pn=${encodeURIComponent(recipientName)}&am=${formattedAmount}&cu=INR&tn=${encodeURIComponent(cleanNote)}` : '';

  // Dynamic QR generator URL
  const qrCodeUrl = upiLink
    ? `https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=10&data=${encodeURIComponent(upiLink)}`
    : '';

  // Smart suggestions if phone is available and no UPI ID configured
  const cleanPhone = (phone || '').replace(/[^0-9]/g, '').slice(-10);
  const suggestedHandles = cleanPhone.length === 10 ? [
    `${cleanPhone}@ybl`,
    `${cleanPhone}@ibl`,
    `${cleanPhone}@paytm`,
    `${cleanPhone}@axl`,
    `${cleanPhone}@upi`,
  ] : [];

  const handleCopyBankDetails = () => {
    const text = `Bank: ${bankName || 'N/A'}\nAccount No: ${accountNumber || 'N/A'}\nIFSC: ${ifscCode || 'N/A'}\nUPI ID: ${effectiveUpi || 'N/A'}\nName: ${recipientName}`;
    navigator.clipboard.writeText(text);
    setCopiedBank(true);
    setTimeout(() => setCopiedBank(false), 2500);
  };

  const handleCopyUpiLink = () => {
    if (!upiLink) return;
    navigator.clipboard.writeText(upiLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleCopyUpiId = () => {
    if (!effectiveUpi) return;
    navigator.clipboard.writeText(effectiveUpi);
    setCopiedUpiId(true);
    setTimeout(() => setCopiedUpiId(false), 2500);
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
        }, 1800);
      }
    } catch (err) {
      console.error('Payment record error:', err);
    } finally {
      setRecording(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-lg overflow-hidden flex flex-col max-h-[92vh]"
        >
          {/* Header */}
          <div className="bg-slate-900 text-white p-5 sm:p-6 relative overflow-hidden">
            <div className="absolute -right-8 -top-8 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl" />
            <div className="flex justify-between items-start relative z-10">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400">
                  {recipientType === 'customer' ? 'Farmer Settlement Payout' : 'Worker Monthly Salary'}
                </p>
                <h3 className="text-xl sm:text-2xl font-display font-bold text-white mt-0.5">{recipientName}</h3>
                {note && <p className="text-xs text-slate-400 mt-0.5">{note}</p>}
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
              <span className="text-xs font-bold text-slate-300 uppercase tracking-widest">Payable Net Amount</span>
              <span className="text-3xl sm:text-4xl font-display font-black text-emerald-400">₹{amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
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
              <QrCode size={14} /> UPI / QR
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
          <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4">
            {recordedSuccess ? (
              <div className="py-12 text-center space-y-3">
                <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle2 size={32} />
                </div>
                <h4 className="text-lg font-bold text-slate-900">Payment Successfully Recorded!</h4>
                <p className="text-xs text-slate-500">₹{amount.toFixed(0)} paid to {recipientName} has been logged in the settlement ledger.</p>
              </div>
            ) : activeTab === 'upi' ? (
              <div className="space-y-4 text-center">
                {effectiveUpi ? (
                  <>
                    <div className="bg-slate-50 p-4 sm:p-5 rounded-2xl border border-slate-100 flex flex-col items-center">
                      <div className="relative bg-white p-2.5 rounded-2xl shadow-sm border border-slate-200">
                        <img 
                          src={qrCodeUrl} 
                          alt="Dynamic UPI QR Code" 
                          className="w-48 h-48 sm:w-52 sm:h-52 rounded-xl object-contain" 
                        />
                        <div className="absolute inset-x-0 bottom-1 flex justify-center">
                          <span className="bg-slate-900/80 text-white text-[9px] font-bold px-2 py-0.5 rounded-full backdrop-blur-sm">
                            ₹{amount.toFixed(0)}
                          </span>
                        </div>
                      </div>

                      <div className="mt-3 flex items-center gap-2">
                        <p className="text-xs font-bold text-slate-800 flex items-center gap-1.5 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">
                          <ShieldCheck size={14} className="text-emerald-600 shrink-0" />
                          <span className="font-mono">{effectiveUpi}</span>
                        </p>
                        <button
                          onClick={handleCopyUpiId}
                          className="p-1 text-slate-400 hover:text-slate-700 transition-colors"
                          title="Copy UPI ID"
                        >
                          {copiedUpiId ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                        </button>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1">Scan with GPay, PhonePe, Paytm, or any BHIM UPI App</p>
                    </div>

                    {/* Quick App Launch Deep Links (for mobile & tablet users) */}
                    <div className="space-y-2">
                      <a
                        href={upiLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full inline-flex items-center justify-center gap-2 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold text-sm shadow-lg shadow-emerald-600/20 transition-all touch-btn"
                      >
                        <Smartphone size={16} /> Pay via Any UPI App (GPay / PhonePe)
                      </a>

                      <div className="grid grid-cols-3 gap-2">
                        <a
                          href={gpayLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="py-2.5 px-2 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl font-bold text-[11px] border border-slate-200 text-center transition-all flex items-center justify-center gap-1"
                        >
                          <ExternalLink size={12} /> Google Pay
                        </a>
                        <a
                          href={phonePeLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="py-2.5 px-2 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-xl font-bold text-[11px] border border-purple-200 text-center transition-all flex items-center justify-center gap-1"
                        >
                          <ExternalLink size={12} /> PhonePe
                        </a>
                        <a
                          href={paytmLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="py-2.5 px-2 bg-sky-50 hover:bg-sky-100 text-sky-700 rounded-xl font-bold text-[11px] border border-sky-200 text-center transition-all flex items-center justify-center gap-1"
                        >
                          <ExternalLink size={12} /> Paytm
                        </a>
                      </div>

                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={handleCopyUpiLink}
                          className="flex-1 py-2 px-3 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                        >
                          {copiedLink ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                          {copiedLink ? 'UPI Link Copied!' : 'Copy Payment Link'}
                        </button>
                        <button
                          onClick={() => {
                            if (navigator.share && upiLink) {
                              navigator.share({
                                title: `Milk Payout to ${recipientName}`,
                                text: `Pay ₹${formattedAmount} for DairyFlow milk payout: ${upiLink}`,
                              }).catch(() => {});
                            } else {
                              handleCopyUpiLink();
                            }
                          }}
                          className="py-2 px-3 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                        >
                          <Share2 size={13} />
                        </button>
                      </div>
                    </div>

                    {/* Change UPI ID toggle */}
                    <div className="pt-2 text-left">
                      <button
                        onClick={() => setCustomUpi('')}
                        className="text-[11px] text-emerald-600 hover:underline font-bold flex items-center gap-1"
                      >
                        ✎ Use different UPI ID for this payout
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="space-y-4 text-left">
                    <div className="bg-amber-50 border border-amber-200 p-3.5 rounded-2xl">
                      <p className="text-xs text-amber-800 font-bold">No UPI ID saved for {recipientName}</p>
                      <p className="text-[11px] text-amber-700 mt-0.5">Enter their UPI ID or select one of the suggested handles below to generate a dynamic QR code.</p>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-slate-600 uppercase">Enter UPI ID</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={customUpi}
                          onChange={(e) => setCustomUpi(e.target.value)}
                          placeholder="e.g. 9876543210@ybl or farmer@upi"
                          className="input-base text-xs flex-1"
                        />
                      </div>
                    </div>

                    {suggestedHandles.length > 0 && (
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1">
                          <Sparkles size={11} className="text-amber-500" /> Suggested from Phone ({cleanPhone})
                        </label>
                        <div className="flex flex-wrap gap-1.5">
                          {suggestedHandles.map((handle) => (
                            <button
                              key={handle}
                              onClick={() => setCustomUpi(handle)}
                              className="px-2.5 py-1 bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 text-slate-700 rounded-lg text-xs font-mono border border-slate-200 transition-colors"
                            >
                              {handle}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Quick record payout button at bottom of UPI tab */}
                <div className="pt-3 border-t border-slate-100">
                  <button
                    onClick={() => {
                      setPaymentMode('upi');
                      setActiveTab('cash');
                    }}
                    className="w-full text-center text-xs font-bold text-slate-500 hover:text-slate-800 py-1"
                  >
                    Paid already? <span className="text-emerald-600 underline">Record transaction in history</span>
                  </button>
                </div>
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
                  {copiedBank ? <Check size={16} className="text-emerald-600" /> : <Copy size={15} />}
                  {copiedBank ? 'Copied to Clipboard!' : 'Copy Bank & IFSC Details'}
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-slate-500 font-medium">Record this payment directly into the settlement journal / payout history:</p>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-slate-600 uppercase">Payment Mode</label>
                  <select
                    value={paymentMode}
                    onChange={(e) => setPaymentMode(e.target.value as any)}
                    className="input-base text-xs"
                  >
                    <option value="upi">📱 UPI App (GPay/PhonePe/Paytm)</option>
                    <option value="bank_transfer">🏦 Bank Transfer (NEFT/IMPS)</option>
                    <option value="cash">💵 Cash Payment</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-slate-600 uppercase">Reference / Transaction No. (Optional)</label>
                  <input
                    type="text"
                    value={refNo}
                    onChange={(e) => setRefNo(e.target.value)}
                    placeholder="e.g. UPI Ref #, UTR or Cheque No."
                    className="input-base text-xs"
                  />
                </div>
                <button
                  onClick={handleRecordPayment}
                  disabled={recording}
                  className="w-full flex items-center justify-center gap-2 py-3.5 bg-slate-900 text-white hover:bg-slate-800 rounded-2xl font-bold text-xs transition-all touch-btn mt-4 shadow-md"
                >
                  {recording ? 'Recording...' : 'Mark as Paid & Save in Ledger'}
                </button>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

