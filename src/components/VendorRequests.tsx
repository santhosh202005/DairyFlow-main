import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  ClipboardList, Clock, CheckCircle2, XCircle, Eye, Check, X,
  Edit2, Store, Phone, MapPin, Mail, User, AlertTriangle,
  Search, RefreshCw
} from "lucide-react";
import { apiFetch } from "../api";

export interface VendorRequest {
  id: number;
  vendor_name: string;
  address?: string;
  phone?: string;
  email: string;
  requested_username: string;
  status: "pending" | "approved" | "rejected";
  admin_note?: string;
  created_at: string;
  reviewed_at?: string;
}

type FilterStatus = "pending" | "all" | "approved" | "rejected";

const STATUS_CONFIG = {
  pending: { label: "Pending", color: "amber", icon: Clock, bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
  approved: { label: "Approved", color: "emerald", icon: CheckCircle2, bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
  rejected: { label: "Rejected", color: "rose", icon: XCircle, bg: "bg-rose-50", text: "text-rose-700", border: "border-rose-200" },
};

export default function VendorRequests() {
  const [requests, setRequests] = useState<VendorRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("pending");
  const [searchQuery, setSearchQuery] = useState("");

  const [viewRequest, setViewRequest] = useState<VendorRequest | null>(null);
  const [editRequest, setEditRequest] = useState<VendorRequest | null>(null);
  const [rejectRequest, setRejectRequest] = useState<VendorRequest | null>(null);
  const [approveRequest, setApproveRequest] = useState<VendorRequest | null>(null);

  const [editForm, setEditForm] = useState({ vendor_name: "", address: "", phone: "", email: "", requested_username: "" });
  const [rejectNote, setRejectNote] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMsg, setActionMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const data = await apiFetch<{ requests: VendorRequest[] }>("/api/admin/vendor-requests", {
        headers: { Authorization: "Bearer admin-token" },
      });
      setRequests(data.requests || []);
    } catch (e) {
      console.error("Failed to fetch vendor requests", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const showMsg = (type: "success" | "error", text: string) => {
    setActionMsg({ type, text });
    setTimeout(() => setActionMsg(null), 4000);
  };

  const handleApprove = async () => {
    if (!approveRequest) return;
    setActionLoading(true);
    try {
      const res = await apiFetch<{ success: boolean; message: string }>(`/api/admin/vendor-requests/${approveRequest.id}/approve`, {
        method: "PUT",
        headers: { Authorization: "Bearer admin-token" },
      });
      showMsg("success", res.message || `Vendor account created for ${approveRequest.vendor_name}!`);
      setApproveRequest(null);
      fetchRequests();
    } catch (err: any) {
      showMsg("error", err?.message || "Failed to approve request.");
    } finally {
      setActionLoading(false);
    }
  };


  const handleReject = async () => {
    if (!rejectRequest) return;
    setActionLoading(true);
    try {
      await apiFetch(`/api/admin/vendor-requests/${rejectRequest.id}/reject`, {
        method: "PUT",
        headers: { Authorization: "Bearer admin-token", "Content-Type": "application/json" },
        body: JSON.stringify({ admin_note: rejectNote }),
      });
      showMsg("success", `Request from ${rejectRequest.vendor_name} rejected.`);
      setRejectRequest(null);
      setRejectNote("");
      fetchRequests();
    } catch (err: any) {
      showMsg("error", err?.message || "Failed to reject request.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editRequest) return;
    setActionLoading(true);
    try {
      await apiFetch(`/api/admin/vendor-requests/${editRequest.id}`, {
        method: "PUT",
        headers: { Authorization: "Bearer admin-token", "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      showMsg("success", "Vendor request information updated successfully.");
      setEditRequest(null);
      fetchRequests();
    } catch (err: any) {
      showMsg("error", err?.message || "Failed to update request.");
    } finally {
      setActionLoading(false);
    }
  };

  const openEdit = (r: VendorRequest) => {
    setEditForm({
      vendor_name: r.vendor_name,
      address: r.address || "",
      phone: r.phone || "",
      email: r.email,
      requested_username: r.requested_username,
    });
    setEditRequest(r);
  };

  const stats = {
    total: requests.length,
    pending: requests.filter((r) => r.status === "pending").length,
    approved: requests.filter((r) => r.status === "approved").length,
    rejected: requests.filter((r) => r.status === "rejected").length,
  };

  const filtered = requests.filter((r) => {
    const matchesStatus = filterStatus === "all" || r.status === filterStatus;
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      !q ||
      r.vendor_name.toLowerCase().includes(q) ||
      r.email.toLowerCase().includes(q) ||
      r.requested_username.toLowerCase().includes(q);
    return matchesStatus && matchesSearch;
  });

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <div className="space-y-6">
      {/* Toast Alert */}
      <AnimatePresence>
        {actionMsg && (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className={`fixed top-6 left-1/2 -translate-x-1/2 z-[200] px-6 py-3 rounded-2xl shadow-xl text-sm font-semibold flex items-center gap-2 ${
              actionMsg.type === "success" ? "bg-emerald-600 text-white" : "bg-rose-600 text-white"
            }`}
          >
            {actionMsg.type === "success" ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
            {actionMsg.text}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Pending Vendor Requests</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Review registration requests, edit information, approve and automatically email vendor credentials.
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Pending Requests", value: stats.pending, icon: Clock, color: "bg-amber-50 text-amber-600" },
          { label: "Approved Vendors", value: stats.approved, icon: CheckCircle2, color: "bg-emerald-50 text-emerald-600" },
          { label: "Rejected Requests", value: stats.rejected, icon: XCircle, color: "bg-rose-50 text-rose-600" },
          { label: "Total Received", value: stats.total, icon: ClipboardList, color: "bg-slate-50 text-slate-600" },
        ].map((stat) => {
          const Icon = stat.icon;
          return (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-2xl p-5 border border-slate-100 shadow-soft"
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${stat.color}`}>
                <Icon size={20} />
              </div>
              <p className="text-2xl font-bold text-slate-900">{loading ? "—" : stat.value}</p>
              <p className="text-xs text-slate-500 font-medium mt-0.5">{stat.label}</p>
            </motion.div>
          );
        })}
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by vendor, username, or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 transition-all"
          />
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          {(["pending", "all", "approved", "rejected"] as FilterStatus[]).map((s) => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`px-3 py-2 rounded-xl text-xs font-semibold capitalize transition-all border ${
                filterStatus === s
                  ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                  : "bg-white text-slate-500 border-slate-200 hover:border-emerald-300 hover:text-emerald-600"
              }`}
            >
              {s === "pending"
                ? `Pending (${stats.pending})`
                : s === "approved"
                ? `Approved (${stats.approved})`
                : s === "rejected"
                ? `Rejected (${stats.rejected})`
                : `All (${stats.total})`}
            </button>
          ))}
          <button
            onClick={fetchRequests}
            disabled={loading}
            className="p-2.5 rounded-xl bg-white border border-slate-200 text-slate-500 hover:text-emerald-600 hover:border-emerald-300 transition-all"
            title="Refresh"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-20 bg-white rounded-2xl border border-slate-100">
          <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <ClipboardList size={28} className="text-slate-400" />
          </div>
          <p className="text-slate-500 font-medium">
            {searchQuery || filterStatus !== "all" ? "No vendor requests match this filter." : "No vendor access requests submitted yet."}
          </p>
        </motion.div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
            {filtered.map((req, idx) => {
              const cfg = STATUS_CONFIG[req.status];
              const StatusIcon = cfg.icon;
              return (
                <motion.div
                  key={req.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.97 }}
                  transition={{ delay: idx * 0.03 }}
                  className={`bg-white rounded-2xl border ${
                    req.status === "pending" ? "border-amber-200 ring-1 ring-amber-100" : "border-slate-100"
                  } shadow-soft overflow-hidden`}
                >
                  <div className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <div className="w-9 h-9 bg-emerald-50 rounded-xl flex items-center justify-center">
                          <Store size={18} className="text-emerald-600" />
                        </div>
                        <h3 className="font-bold text-slate-900 text-base">{req.vendor_name}</h3>
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
                          <StatusIcon size={12} />
                          {cfg.label}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-slate-500 mt-2">
                        <span className="flex items-center gap-1.5 font-medium text-slate-700 bg-slate-50 px-2.5 py-1 rounded-lg">
                          <User size={12} className="text-slate-400" /> @{req.requested_username}
                        </span>
                        <span className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-lg">
                          <Mail size={12} className="text-slate-400" /> {req.email}
                        </span>
                        {req.phone && (
                          <span className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-lg">
                            <Phone size={12} className="text-slate-400" /> {req.phone}
                          </span>
                        )}
                        {req.address && (
                          <span className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-lg">
                            <MapPin size={12} className="text-slate-400" /> {req.address}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-2">
                        <span>Submitted {formatDate(req.created_at)}</span>
                        {req.reviewed_at && <span>Reviewed {formatDate(req.reviewed_at)}</span>}
                      </div>
                      {req.admin_note && (
                        <p className="text-xs text-rose-600 bg-rose-50 border border-rose-100 rounded-lg p-2 mt-2">
                          <strong>Admin Note:</strong> {req.admin_note}
                        </p>
                      )}
                    </div>

                    {/* Action buttons */}
                    <div className="flex flex-wrap items-center gap-2 shrink-0 pt-3 md:pt-0 border-t md:border-t-0 border-slate-100">
                      <button
                        onClick={() => setViewRequest(req)}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-semibold hover:bg-slate-200 transition-all"
                      >
                        <Eye size={14} /> View Details
                      </button>

                      <button
                        onClick={() => openEdit(req)}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold hover:bg-blue-100 transition-all"
                      >
                        <Edit2 size={14} /> Edit Info
                      </button>

                      {req.status === "pending" && (
                        <>
                          <button
                            onClick={() => setApproveRequest(req)}
                            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 shadow-md shadow-emerald-600/20 transition-all"
                          >
                            <Check size={14} /> Approve
                          </button>
                          <button
                            onClick={() => {
                              setRejectRequest(req);
                              setRejectNote("");
                            }}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 text-xs font-semibold hover:bg-rose-100 transition-all"
                          >
                            <X size={14} /> Reject
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* View Details Modal */}
      <AnimatePresence>
        {viewRequest && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
              onClick={() => setViewRequest(null)}
            />
            <motion.div
              initial={{ opacity: 0, y: 40, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 40, scale: 0.95 }}
              className="fixed inset-x-4 top-1/2 -translate-y-1/2 md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:w-full md:max-w-lg bg-white rounded-2xl shadow-2xl z-50 overflow-hidden"
            >
              <div className="flex items-center justify-between p-6 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center">
                    <Eye size={20} className="text-emerald-600" />
                  </div>
                  <div>
                    <h2 className="font-bold text-slate-900 text-lg">Vendor Request Details</h2>
                    <p className="text-xs text-slate-500">Full information submitted by applicant</p>
                  </div>
                </div>
                <button onClick={() => setViewRequest(null)} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-slate-100 text-slate-400">
                  <X size={18} />
                </button>
              </div>

              <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Current Status</span>
                  {(() => {
                    const cfg = STATUS_CONFIG[viewRequest.status];
                    const StatusIcon = cfg.icon;
                    return (
                      <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
                        <StatusIcon size={14} /> {cfg.label}
                      </span>
                    );
                  })()}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="p-3.5 bg-slate-50 rounded-xl">
                    <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide flex items-center gap-1">
                      <Store size={12} /> Requested Vendor Name
                    </p>
                    <p className="text-base font-bold text-slate-900 mt-1">{viewRequest.vendor_name}</p>
                  </div>
                  <div className="p-3.5 bg-slate-50 rounded-xl">
                    <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide flex items-center gap-1">
                      <User size={12} /> Requested Username
                    </p>
                    <p className="text-base font-bold text-slate-900 mt-1">@{viewRequest.requested_username}</p>
                  </div>
                </div>

                <div className="p-3.5 bg-slate-50 rounded-xl">
                  <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide flex items-center gap-1">
                    <Mail size={12} /> Vendor Email (Gmail Box)
                  </p>
                  <p className="text-sm font-semibold text-slate-800 mt-1">{viewRequest.email}</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="p-3.5 bg-slate-50 rounded-xl">
                    <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide flex items-center gap-1">
                      <Phone size={12} /> Phone Number
                    </p>
                    <p className="text-sm font-medium text-slate-800 mt-1">{viewRequest.phone || "Not specified"}</p>
                  </div>
                  <div className="p-3.5 bg-slate-50 rounded-xl">
                    <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide flex items-center gap-1">
                      <MapPin size={12} /> Address
                    </p>
                    <p className="text-sm font-medium text-slate-800 mt-1">{viewRequest.address || "Not specified"}</p>
                  </div>
                </div>

                <div className="p-3.5 bg-slate-50 rounded-xl text-xs text-slate-500 space-y-1">
                  <p><strong>Submitted Date:</strong> {formatDate(viewRequest.created_at)}</p>
                  {viewRequest.reviewed_at && <p><strong>Decision Date:</strong> {formatDate(viewRequest.reviewed_at)}</p>}
                </div>

                {viewRequest.admin_note && (
                  <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-xs text-rose-700">
                    <p className="font-bold">Admin Rejection Note:</p>
                    <p className="mt-0.5">{viewRequest.admin_note}</p>
                  </div>
                )}
              </div>

              <div className="p-4 bg-slate-50 border-t border-slate-100 flex gap-2">
                <button
                  onClick={() => {
                    const req = viewRequest;
                    setViewRequest(null);
                    openEdit(req);
                  }}
                  className="flex-1 py-2.5 border border-blue-200 bg-white text-blue-600 rounded-xl text-xs font-bold hover:bg-blue-50 flex items-center justify-center gap-1.5 transition-all"
                >
                  <Edit2 size={14} /> Add/Edit Info
                </button>
                {viewRequest.status === "pending" && (
                  <>
                    <button
                      onClick={() => {
                        const req = viewRequest;
                        setViewRequest(null);
                        setApproveRequest(req);
                      }}
                      className="flex-1 py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/20 transition-all"
                    >
                      <Check size={14} /> Approve & Email
                    </button>
                    <button
                      onClick={() => {
                        const req = viewRequest;
                        setViewRequest(null);
                        setRejectRequest(req);
                        setRejectNote("");
                      }}
                      className="flex-1 py-2.5 border border-rose-200 bg-white text-rose-600 rounded-xl text-xs font-bold hover:bg-rose-50 flex items-center justify-center gap-1.5 transition-all"
                    >
                      <X size={14} /> Reject
                    </button>
                  </>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Edit Information Modal */}
      <AnimatePresence>
        {editRequest && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
              onClick={() => setEditRequest(null)}
            />
            <motion.div
              initial={{ opacity: 0, y: 40, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 40, scale: 0.95 }}
              className="fixed inset-x-4 top-1/2 -translate-y-1/2 md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:w-full md:max-w-md bg-white rounded-2xl shadow-2xl z-50 overflow-hidden"
            >
              <div className="flex items-center justify-between p-6 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center">
                    <Edit2 size={18} className="text-blue-600" />
                  </div>
                  <h2 className="font-bold text-slate-900 text-lg">Add/Edit Vendor Information</h2>
                </div>
                <button onClick={() => setEditRequest(null)} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-slate-100 text-slate-400">
                  <X size={18} />
                </button>
              </div>
              <form onSubmit={handleEdit} className="p-6 space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Vendor Name *</label>
                  <input
                    type="text"
                    value={editForm.vendor_name}
                    onChange={(e) => setEditForm((f) => ({ ...f, vendor_name: e.target.value }))}
                    required
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Requested Username *</label>
                  <input
                    type="text"
                    value={editForm.requested_username}
                    onChange={(e) => setEditForm((f) => ({ ...f, requested_username: e.target.value }))}
                    required
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Email (Gmail Box) *</label>
                  <input
                    type="email"
                    value={editForm.email}
                    onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                    required
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Phone Number</label>
                    <input
                      type="tel"
                      value={editForm.phone}
                      onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))}
                      placeholder="Optional"
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Address</label>
                    <input
                      type="text"
                      value={editForm.address}
                      onChange={(e) => setEditForm((f) => ({ ...f, address: e.target.value }))}
                      placeholder="Optional"
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all"
                    />
                  </div>
                </div>
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setEditRequest(null)}
                    className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-60 transition-all"
                  >
                    {actionLoading ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Approve Confirm Modal */}
      <AnimatePresence>
        {approveRequest && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
              onClick={() => setApproveRequest(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="fixed inset-x-4 top-1/2 -translate-y-1/2 md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:w-full md:max-w-sm bg-white rounded-2xl shadow-2xl z-50 p-6 text-center"
            >
              <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 size={28} className="text-emerald-600" />
              </div>
              <h3 className="font-bold text-slate-900 text-lg mb-2">Approve Vendor Request?</h3>
              <p className="text-sm text-slate-500 mb-3">
                This will create a new Vendor account for <strong>{approveRequest.vendor_name}</strong> and send an approval email to their Gmail box.
              </p>
              <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3.5 mb-5 text-left space-y-1.5">
                <p className="text-xs text-emerald-800"><strong>Username:</strong> {approveRequest.requested_username}</p>
                <p className="text-xs text-emerald-800"><strong>Default Password:</strong> vendor@123</p>
                <p className="text-xs text-emerald-800 truncate"><strong>Send email to:</strong> {approveRequest.email}</p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setApproveRequest(null)}
                  disabled={actionLoading}
                  className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleApprove}
                  disabled={actionLoading}
                  className="flex-1 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 disabled:opacity-70 transition-all shadow-md shadow-emerald-600/20"
                >
                  {actionLoading ? "Approving..." : "Approve & Send"}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Reject Modal */}
      <AnimatePresence>
        {rejectRequest && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
              onClick={() => setRejectRequest(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="fixed inset-x-4 top-1/2 -translate-y-1/2 md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:w-full md:max-w-sm bg-white rounded-2xl shadow-2xl z-50 p-6"
            >
              <div className="text-center mb-5">
                <div className="w-14 h-14 bg-rose-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <XCircle size={28} className="text-rose-500" />
                </div>
                <h3 className="font-bold text-slate-900 text-lg">Reject Request?</h3>
                <p className="text-sm text-slate-500 mt-1">
                  Reject vendor registration request from <strong>{rejectRequest.vendor_name}</strong>.
                </p>
              </div>
              <div className="space-y-2 mb-5">
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                  Rejection Reason (optional — included in return email)
                </label>
                <textarea
                  rows={3}
                  value={rejectNote}
                  onChange={(e) => setRejectNote(e.target.value)}
                  placeholder="e.g. Incomplete details, invalid contact number..."
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-500/30 focus:border-rose-400 transition-all resize-none"
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setRejectRequest(null)}
                  disabled={actionLoading}
                  className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleReject}
                  disabled={actionLoading}
                  className="flex-1 py-2.5 bg-rose-500 text-white rounded-xl text-sm font-semibold hover:bg-rose-600 disabled:opacity-70 transition-all"
                >
                  {actionLoading ? "Rejecting..." : "Reject"}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
