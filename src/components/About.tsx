import React from 'react';
import { Info, ShieldCheck, Zap, Heart } from 'lucide-react';

export default function About() {
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
          <div className="px-6 py-3 border border-slate-700 hover:bg-slate-800 rounded-xl font-bold transition-colors cursor-pointer">
            Contact Support
          </div>
        </div>
      </section>

      <footer className="text-center text-slate-400 text-sm">
        <p>© 2026 DairyFlow Management System. All rights reserved.</p>
      </footer>
    </div>
  );
}
