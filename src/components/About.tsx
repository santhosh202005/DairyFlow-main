import React, { useState } from 'react';
import { Info, ShieldCheck, Zap, Heart, X, Phone, Copy, MapPin, Building2, User } from 'lucide-react';

export default function About() {
  const [showSupport, setShowSupport] = useState(false);

  const handleCopyPhone = () => {
    navigator.clipboard.writeText('+91 9042141951, +91 9047261367');
    alert('Phone numbers copied to clipboard!');
  };

  return (
    <div className="max-w-4xl mx-auto space-y-12 py-8">
      <section className="text-center space-y-4">
        <h2 className="text-4xl font-bold text-slate-900 tracking-tight">About DairyFlow</h2>
        <p className="text-lg text-slate-600 max-w-2xl mx-auto">
          DairyFlow is a modern, all-in-one management solution designed specifically for milk business owners. 
          We simplify the complexities of daily operations, so you can focus on what matters most—your customers.
        </p>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 space-y-4">
          <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center">
            <ShieldCheck size={24} />
          </div>
          <h3 className="text-xl font-bold text-slate-900">Reliable Records</h3>
          <p className="text-slate-600">
            Never lose a record again. Our secure database ensures your customer data, daily entries, 
            and billing information are always safe and accessible.
          </p>
        </div>

        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 space-y-4">
          <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center">
            <Zap size={24} />
          </div>
          <h3 className="text-xl font-bold text-slate-900">Instant Billing</h3>
          <p className="text-slate-600">
            Generate monthly bills in seconds. Automatically calculate totals, deduct advances, 
            and provide clear summaries for your customers.
          </p>
        </div>

        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 space-y-4">
          <div className="w-12 h-12 bg-violet-100 text-violet-600 rounded-xl flex items-center justify-center">
            <Heart size={24} />
          </div>
          <h3 className="text-xl font-bold text-slate-900">User Centric</h3>
          <p className="text-slate-600">
            Designed with simplicity in mind. Whether you're on a desktop or mobile, 
            managing your dairy business has never been easier.
          </p>
        </div>

        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 space-y-4">
          <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-xl flex items-center justify-center">
            <Info size={24} />
          </div>
          <h3 className="text-xl font-bold text-slate-900">Our Mission</h3>
          <p className="text-slate-600">
            To empower local dairy businesses with digital tools that enhance efficiency, 
            transparency, and growth in the modern economy.
          </p>
        </div>
      </div>

      <section className="bg-slate-900 text-white p-12 rounded-3xl text-center space-y-6">
        <h3 className="text-2xl font-bold">Ready to streamline your business?</h3>
        <p className="text-slate-400 max-w-xl mx-auto">
          Join hundreds of dairy owners who have already transformed their daily operations with DairyFlow.
        </p>
        <div className="flex justify-center gap-4 pt-4">
          <div className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 rounded-xl font-bold transition-colors cursor-pointer">
            Get Started
          </div>
          <div 
            onClick={() => setShowSupport(true)}
            className="px-6 py-3 border border-slate-700 hover:bg-slate-800 rounded-xl font-bold transition-colors cursor-pointer"
          >
            Contact Support
          </div>
        </div>
      </section>

      <footer className="text-center text-slate-400 text-sm">
        <p>© 2026 DairyFlow Management System. All rights reserved.</p>
      </footer>

      {showSupport && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-[2rem] w-full max-w-md overflow-hidden shadow-2xl relative animate-in fade-in zoom-in duration-200">
            <div className="p-6 md:p-8 space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-2xl font-bold text-slate-900">Contact Support</h3>
                <button 
                  onClick={() => setShowSupport(false)}
                  className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-4">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                    <User size={20} />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Administrator</p>
                    <p className="font-bold text-slate-900">Rajini</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                    <Building2 size={20} />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Business</p>
                    <p className="font-bold text-slate-900">Dairy Flow</p>
                    <p className="text-sm font-medium text-slate-500">Since 1970</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center shrink-0">
                    <Phone size={20} />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Phone Numbers</p>
                    <p className="font-bold text-slate-900">+91 9042141951</p>
                    <p className="font-bold text-slate-900">+91 9047261367</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                    <MapPin size={20} />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Address</p>
                    <p className="font-bold text-slate-900 text-sm leading-relaxed">
                      No. 16, Kannadiyar Street,<br/>
                      Karungalikuppam,<br/>
                      Ranipet District – 632507,<br/>
                      Tamil Nadu, India.
                    </p>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row gap-3">
                <a 
                  href="tel:+919042141951"
                  className="flex-1 bg-emerald-600 text-white flex items-center justify-center gap-2 py-3 rounded-xl font-bold shadow-lg shadow-emerald-100 hover:bg-emerald-700 active:scale-95 transition-all"
                >
                  <Phone size={18} /> Call Administrator
                </a>
                <button 
                  onClick={handleCopyPhone}
                  className="flex-1 bg-white border-2 border-slate-200 text-slate-700 flex items-center justify-center gap-2 py-3 rounded-xl font-bold hover:bg-slate-50 hover:border-slate-300 active:scale-95 transition-all"
                >
                  <Copy size={18} /> Copy Phone
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
