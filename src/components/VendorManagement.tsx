import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Store, Users, Milk, Plus, Edit2, Trash2, X, Eye, EyeOff,
  Phone, MapPin, TrendingUp, ChevronDown, AlertTriangle, Search, ShieldCheck
} from 'lucide-react';
import { apiFetch } from '../api';

interface Vendor {
  id: number;
  name: string;
  username: string;
  password?: string;
  phone?: string;
  address?: string;
  customer_count: number;
  today_supply?: number;
  created_at: string;
}

interface OverviewData {
  vendors: Vendor[];
  totalVendors: number;
  totalCustomers: number;
  unassignedCustomers: number;
}

const emptyForm = { name: '', username: '', password: '', phone: '', address: '' };

export default function VendorManagement() {
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<Vendor | null>(null);

  const fetchOverview = async () => {
    setLoading(true);
    try {
      const data = await apiFetch<OverviewData>('/api/admin/overview', {}, { retries: 2, delayMs: 500 });
      setOverview(data);
    } catch (e) {
      console.error('Failed to fetch overview', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchOverview(); }, []);

  const openAdd = () => {
    setEditingVendor(null);
    setForm(emptyForm);
    setError('');
    setShowPassword(false);
    setShowModal(true);
  };

  const openEdit = (v: Vendor) => {
    setEditingVendor(v);
    setForm({ name: v.name, username: v.username, password: '', phone: v.phone || '', address: v.address || '' });
    setError('');
    setShowPassword(false);
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.username.trim()) {
      setError('Name and username are required.');
      return;
    }
    if (!editingVendor && !form.password.trim()) {
      setError('Password is required for new vendors.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const payload: any = {
        name: form.name.trim(),
        username: form.username.trim(),
        phone: form.phone.trim() || null,
        address: form.address.trim() || null,
      };
      if (form.password.trim()) payload.password = form.password.trim();
      else if (editingVendor) payload.password = editingVendor.password || form.password;

      if (editingVendor) {
        await apiFetch(`/api/vendors/${editingVendor.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch('/api/vendors', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }
      setShowModal(false);
      fetchOverview();
    } catch (err: any) {
      setError(err?.message || 'Failed to save vendor. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (vendor: Vendor) => {
    try {
      await apiFetch(`/api/vendors/${vendor.id}`, { method: 'DELETE' });
      setDeleteConfirm(null);
      fetchOverview();
    } catch (err) {
      console.error('Delete failed', err);
    }
  };

  const filtered = (overview?.vendors || []).filter(v =>
    v.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    v.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {[
          { label: 'Total Vendors', value: overview?.totalVendors ?? '—', icon: Store, color: 'emerald' },
          { label: 'Total Farmers', value: overview?.totalCustomers ?? '—', icon: Users, color: 'blue' },
          { label: 'Unassigned', value: overview?.unassignedCustomers ?? '—', icon: AlertTriangle, color: 'amber' },
        ].map(stat => {
          const Icon = stat.icon;
          const colors: Record<string, string> = {
            emerald: 'bg-emerald-50 text-emerald-600',
            blue: 'bg-blue-50 text-blue-600',
            amber: 'bg-amber-50 text-amber-600',
          };
          return (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-2xl p-5 border border-slate-100 shadow-soft"
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${colors[stat.color]}`}>
                <Icon size={20} />
              </div>
              <p className="text-2xl font-bold text-slate-900">{loading ? '—' : stat.value}</p>
              <p className="text-xs text-slate-500 font-medium mt-0.5">{stat.label}</p>
            </motion.div>
          );
        })}
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search vendors..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 transition-all"
          />
        </div>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={openAdd}
          className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-xl font-semibold text-sm shadow-lg shadow-emerald-100 hover:bg-emerald-700 transition-colors"
        >
          <Plus size={18} />
          Add Vendor
        </motion.button>
      </div>

      {/* Vendor Cards */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-20 bg-white rounded-2xl border border-slate-100"
        >
          <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Store size={28} className="text-slate-400" />
          </div>
          <p className="text-slate-500 font-medium">
            {searchQuery ? 'No vendors match your search.' : 'No vendors yet. Add your first vendor!'}
          </p>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <AnimatePresence>
            {filtered.map((vendor, idx) => (
              <motion.div
                key={vendor.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: idx * 0.04 }}
                className="bg-white rounded-2xl border border-slate-100 shadow-soft overflow-hidden group hover:border-emerald-200 hover:shadow-md transition-all"
              >
                {/* Card header */}
                <div className="bg-gradient-to-br from-emerald-500 to-emerald-700 p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center">
                        <Store size={22} className="text-white" />
                      </div>
                      <div>
                        <h3 className="font-bold text-white text-lg leading-tight">{vendor.name}</h3>
                        <p className="text-emerald-100 text-xs font-medium">@{vendor.username}</p>
                      </div>
                    </div>
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => openEdit(vendor)}
                        className="w-8 h-8 bg-white/20 hover:bg-white/30 rounded-lg flex items-center justify-center transition-colors"
                      >
                        <Edit2 size={14} className="text-white" />
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(vendor)}
                        className="w-8 h-8 bg-white/20 hover:bg-red-400/40 rounded-lg flex items-center justify-center transition-colors"
                      >
                        <Trash2 size={14} className="text-white" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Card body */}
                <div className="p-4 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-50 rounded-xl p-3 text-center">
                      <div className="flex items-center justify-center gap-1.5 mb-1">
                        <Users size={14} className="text-blue-500" />
                        <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Farmers</span>
                      </div>
                      <p className="text-xl font-bold text-slate-900">{vendor.customer_count}</p>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-3 text-center">
                      <div className="flex items-center justify-center gap-1.5 mb-1">
                        <Milk size={14} className="text-emerald-500" />
                        <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Today</span>
                      </div>
                      <p className="text-xl font-bold text-slate-900">{Number(vendor.today_supply || 0).toFixed(1)} L</p>
                    </div>
                  </div>

                  {(vendor.phone || vendor.address) && (
                    <div className="space-y-1.5 pt-1 border-t border-slate-100">
                      {vendor.phone && (
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          <Phone size={12} className="text-slate-400 shrink-0" />
                          <span>{vendor.phone}</span>
                        </div>
                      )}
                      {vendor.address && (
                        <div className="flex items-start gap-2 text-xs text-slate-500">
                          <MapPin size={12} className="text-slate-400 shrink-0 mt-0.5" />
                          <span className="leading-tight">{vendor.address}</span>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="pt-1 border-t border-slate-100">
                    <div className="flex items-center gap-1.5">
                      <ShieldCheck size={12} className="text-emerald-500" />
                      <span className="text-[10px] text-slate-400 font-medium">
                        Joined {new Date(vendor.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {showModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
              onClick={() => setShowModal(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: 40, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 40, scale: 0.95 }}
              className="fixed inset-x-4 top-1/2 -translate-y-1/2 md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:w-full md:max-w-md bg-white rounded-2xl shadow-2xl z-50 overflow-hidden"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between p-6 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-emerald-50 rounded-xl flex items-center justify-center">
                    <Store size={18} className="text-emerald-600" />
                  </div>
                  <h2 className="font-bold text-slate-900 text-lg">
                    {editingVendor ? 'Edit Vendor' : 'Add New Vendor'}
                  </h2>
                </div>
                <button
                  onClick={() => setShowModal(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-slate-100 text-slate-400 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Modal Body */}
              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                {error && (
                  <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-xl text-red-600 text-sm">
                    <AlertTriangle size={15} />
                    {error}
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Vendor Name *</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="e.g. Rajan Dairy Center"
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 transition-all"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Username *</label>
                  <input
                    type="text"
                    value={form.username}
                    onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                    placeholder="e.g. rajan_dairy"
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 transition-all"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                    Password {editingVendor ? '(leave blank to keep current)' : '*'}
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={form.password}
                      onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                      placeholder={editingVendor ? '••••••••' : 'Set a password'}
                      className="w-full px-4 py-2.5 pr-10 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(s => !s)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Phone</label>
                    <input
                      type="tel"
                      value={form.phone}
                      onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                      placeholder="Mobile number"
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 transition-all"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Address</label>
                    <input
                      type="text"
                      value={form.address}
                      onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                      placeholder="Location"
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 transition-all"
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 disabled:opacity-60 transition-colors"
                  >
                    {submitting ? 'Saving...' : editingVendor ? 'Save Changes' : 'Add Vendor'}
                  </button>
                </div>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Delete Confirm Modal */}
      <AnimatePresence>
        {deleteConfirm && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
              onClick={() => setDeleteConfirm(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="fixed inset-x-4 top-1/2 -translate-y-1/2 md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:w-full md:max-w-sm bg-white rounded-2xl shadow-2xl z-50 p-6 text-center"
            >
              <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Trash2 size={24} className="text-red-500" />
              </div>
              <h3 className="font-bold text-slate-900 text-lg mb-2">Delete Vendor?</h3>
              <p className="text-sm text-slate-500 mb-1">
                Are you sure you want to delete <strong>{deleteConfirm.name}</strong>?
              </p>
              <p className="text-xs text-amber-600 bg-amber-50 rounded-xl p-3 mb-5">
                ⚠️ Their {deleteConfirm.customer_count} farmer(s) will become unassigned. No farmer data will be deleted.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDelete(deleteConfirm)}
                  className="flex-1 py-2.5 bg-red-500 text-white rounded-xl text-sm font-semibold hover:bg-red-600"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
