import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, 
  Trash2, 
  Calendar, 
  User, 
  Edit2, 
  X, 
  ShieldCheck, 
  Syringe, 
  Search, 
  Filter, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  Info,
  ChevronRight,
  FileText
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Cattle, CattleVaccination, Customer, CattleType, CattleStatus } from '../types';
import { useTranslation } from '../i18n';

interface CattleManagementProps {
  customerId?: string;
  vendorId?: string;
  isAdmin?: boolean;
  isVendor?: boolean;
  isFarmer?: boolean;
}

const getAuthHeaders = (): Record<string, string> => {
  const token = localStorage.getItem('dairy_auth_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export default function CattleManagement({
  customerId,
  vendorId,
  isAdmin = false,
  isVendor = false,
  isFarmer = false,
}: CattleManagementProps) {
  const { t } = useTranslation();

  const [cattleList, setCattleList] = useState<Cattle[]>([]);
  const [vaccinations, setVaccinations] = useState<CattleVaccination[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | CattleType>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | CattleStatus>('all');
  const [selectedCustomerFilter, setSelectedCustomerFilter] = useState<string>(customerId || 'all');

  // Modals & Active Cattle
  const [isCattleModalOpen, setIsCattleModalOpen] = useState(false);
  const [editingCattle, setEditingCattle] = useState<Cattle | null>(null);

  const [isVaccineModalOpen, setIsVaccineModalOpen] = useState(false);
  const [editingVaccine, setEditingVaccine] = useState<CattleVaccination | null>(null);
  const [activeCattleForVaccine, setActiveCattleForVaccine] = useState<Cattle | null>(null);

  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [activeCattleForHistory, setActiveCattleForHistory] = useState<Cattle | null>(null);

  // Form states
  const [cattleForm, setCattleForm] = useState<{
    customer_id: string;
    name: string;
    type: CattleType;
    dob: string;
    status: CattleStatus;
  }>({
    customer_id: customerId ? customerId.toString() : '',
    name: '',
    type: 'cow',
    dob: '',
    status: 'active',
  });

  const [vaccineForm, setVaccineForm] = useState<{
    cattle_id: string;
    customer_id: string;
    vaccination_date: string;
    next_due_date: string;
    administered_by: string;
    notes: string;
  }>({
    cattle_id: '',
    customer_id: customerId ? customerId.toString() : '',
    vaccination_date: new Date().toISOString().split('T')[0],
    next_due_date: '',
    administered_by: '',
    notes: '',
  });

  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch initial data
  useEffect(() => {
    fetchCattle();
    fetchVaccinations();
    if (isAdmin || isVendor) {
      fetchCustomers();
    }
  }, [customerId, vendorId, isAdmin, isVendor]);

  const fetchCattle = async () => {
    setIsLoading(true);
    try {
      let url = '/api/cattle';
      const params = new URLSearchParams();
      if (customerId) params.append('customerId', customerId);
      else if (vendorId) params.append('vendorId', vendorId);
      if (params.toString()) url += `?${params.toString()}`;

      const res = await fetch(url, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setCattleList(data);
      }
    } catch (err) {
      console.error('Error fetching cattle:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchVaccinations = async (targetCattleId?: string) => {
    try {
      let url = '/api/cattle-vaccinations';
      const params = new URLSearchParams();
      if (targetCattleId) params.append('cattleId', targetCattleId);
      if (customerId) params.append('customerId', customerId);
      else if (vendorId) params.append('vendorId', vendorId);
      if (params.toString()) url += `?${params.toString()}`;

      const res = await fetch(url, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setVaccinations(data);
      }
    } catch (err) {
      console.error('Error fetching vaccinations:', err);
    }
  };

  const fetchCustomers = async () => {
    try {
      const url = vendorId ? `/api/customers?vendorId=${vendorId}` : '/api/customers';
      const res = await fetch(url, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setCustomers(data);
      }
    } catch (err) {
      console.error('Error fetching customers:', err);
    }
  };

  // Open Add / Edit Cattle Modal
  const handleOpenAddCattle = () => {
    setEditingCattle(null);
    const defaultCustId = customerId || (customers.length > 0 ? String(customers[0].id) : '');
    setCattleForm({
      customer_id: defaultCustId,
      name: '',
      type: 'cow',
      dob: '',
      status: 'active',
    });
    setFormError('');
    setIsCattleModalOpen(true);
  };

  const handleOpenEditCattle = (c: Cattle) => {
    setEditingCattle(c);
    setCattleForm({
      customer_id: String(c.customer_id),
      name: c.name || '',
      type: c.type || 'cow',
      dob: c.dob || '',
      status: c.status || 'active',
    });
    setFormError('');
    setIsCattleModalOpen(true);
  };

  const handleCattleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setIsSubmitting(true);

    try {
      const targetCustomerId = isFarmer ? customerId : (cattleForm.customer_id || customerId || (customers[0]?.id ? String(customers[0].id) : ''));
      if (!targetCustomerId) {
        setFormError('Please select a farmer');
        setIsSubmitting(false);
        return;
      }

      const url = editingCattle ? `/api/cattle/${editingCattle.id}` : '/api/cattle';
      const method = editingCattle ? 'PUT' : 'POST';

      const payload = {
        customer_id: targetCustomerId,
        name: cattleForm.name.trim() || undefined,
        type: cattleForm.type,
        dob: cattleForm.dob || undefined,
        status: cattleForm.status,
      };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(payload),
      });

      let data: any = {};
      const resText = await res.text();
      try {
        data = JSON.parse(resText);
      } catch {
        data = { error: res.ok ? undefined : 'Server error: ' + (res.statusText || res.status) };
      }

      if (!res.ok) {
        setFormError(data.error || data.message || 'Failed to save cattle record');
        return;
      }

      setIsCattleModalOpen(false);
      fetchCattle();
    } catch (err: any) {
      setFormError(err?.message || 'Network error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteCattle = async (id: string, name?: string) => {
    const label = name ? `"${name}"` : 'this cattle record';
    if (!window.confirm(`Are you sure you want to delete ${label}? All its vaccination records will also be removed.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/cattle/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        fetchCattle();
        fetchVaccinations();
      } else {
        alert('Failed to delete cattle record');
      }
    } catch {
      alert('Error connecting to server');
    }
  };

  // Open Log / Edit Vaccination Modal
  const handleOpenLogVaccine = (cattle?: Cattle) => {
    const targetCattle = cattle || cattleList[0];
    if (!targetCattle) {
      alert('Please add a cattle profile first before logging vaccination.');
      return;
    }
    setActiveCattleForVaccine(targetCattle);
    setEditingVaccine(null);
    setVaccineForm({
      cattle_id: String(targetCattle.id),
      customer_id: String(targetCattle.customer_id),
      vaccination_date: new Date().toISOString().split('T')[0],
      next_due_date: '',
      administered_by: '',
      notes: '',
    });
    setFormError('');
    setIsVaccineModalOpen(true);
  };

  const handleOpenEditVaccine = (v: CattleVaccination) => {
    setEditingVaccine(v);
    setVaccineForm({
      cattle_id: String(v.cattle_id),
      customer_id: String(v.customer_id),
      vaccination_date: v.vaccination_date,
      next_due_date: v.next_due_date || '',
      administered_by: v.administered_by || '',
      notes: v.notes || '',
    });
    setFormError('');
    setIsVaccineModalOpen(true);
  };

  const handleVaccineSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setIsSubmitting(true);

    try {
      const url = editingVaccine ? `/api/cattle-vaccinations/${editingVaccine.id}` : '/api/cattle-vaccinations';
      const method = editingVaccine ? 'PUT' : 'POST';

      const payload = {
        cattle_id: vaccineForm.cattle_id,
        customer_id: vaccineForm.customer_id,
        vaccination_date: vaccineForm.vaccination_date,
        next_due_date: vaccineForm.next_due_date || undefined,
        administered_by: vaccineForm.administered_by.trim() || undefined,
        notes: vaccineForm.notes.trim() || undefined,
      };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(payload),
      });

      let data: any = {};
      const resText = await res.text();
      try {
        data = JSON.parse(resText);
      } catch {
        data = { error: res.ok ? undefined : 'Server error: ' + (res.statusText || res.status) };
      }

      if (!res.ok) {
        setFormError(data.error || data.message || 'Failed to save vaccination record');
        return;
      }

      setIsVaccineModalOpen(false);
      fetchCattle();
      fetchVaccinations();
      if (activeCattleForHistory) {
        fetchVaccinations(String(activeCattleForHistory.id));
      }
    } catch (err: any) {
      setFormError(err?.message || 'Network error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteVaccine = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this vaccination record?')) return;
    try {
      const res = await fetch(`/api/cattle-vaccinations/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        fetchCattle();
        fetchVaccinations();
      }
    } catch {
      alert('Error connecting to server');
    }
  };

  // Open History Timeline
  const handleOpenHistory = (c: Cattle) => {
    setActiveCattleForHistory(c);
    setIsHistoryModalOpen(true);
  };

  // Filtered Cattle List
  const filteredCattle = useMemo(() => {
    return cattleList.filter((c) => {
      if (typeFilter !== 'all' && c.type !== typeFilter) return false;
      if (statusFilter !== 'all' && c.status !== statusFilter) return false;
      if (selectedCustomerFilter !== 'all' && String(c.customer_id) !== String(selectedCustomerFilter)) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = c.name && c.name.toLowerCase().includes(q);
        const matchCustomer = c.customer_name && c.customer_name.toLowerCase().includes(q);
        const matchCode = c.customer_code && c.customer_code.toLowerCase().includes(q);
        if (!matchName && !matchCustomer && !matchCode) return false;
      }
      return true;
    });
  }, [cattleList, typeFilter, statusFilter, selectedCustomerFilter, searchQuery]);

  // Summary Metrics
  const stats = useMemo(() => {
    const total = cattleList.length;
    const cows = cattleList.filter((c) => c.type === 'cow').length;
    const buffaloes = cattleList.filter((c) => c.type === 'buffalo').length;
    const totalVaccines = vaccinations.length;

    const todayStr = new Date().toISOString().split('T')[0];
    const upcomingDues = vaccinations.filter(
      (v) => v.next_due_date && v.next_due_date >= todayStr
    ).length;

    return { total, cows, buffaloes, totalVaccines, upcomingDues };
  }, [cattleList, vaccinations]);

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Top Banner / Title Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-3xl border border-slate-100 shadow-soft">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shadow-inner">
              <ShieldCheck size={26} />
            </div>
            <div>
              <h2 className="text-xl md:text-2xl font-display font-bold text-slate-900">
                {t('cattleManagement') || 'Farm & Cattle Management'}
              </h2>
              <p className="text-xs md:text-sm text-slate-500 font-medium">
                {isFarmer
                  ? 'Track your cows, buffaloes and their vaccination schedules'
                  : 'Manage farmer cattle profiles and vaccination history'}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button
            onClick={() => handleOpenLogVaccine()}
            disabled={cattleList.length === 0}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-3 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-2xl text-xs md:text-sm font-semibold shadow-md transition-all cursor-pointer"
          >
            <Syringe size={16} />
            <span>{t('logVaccination') || 'Log Vaccine'}</span>
          </button>

          <button
            onClick={handleOpenAddCattle}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs md:text-sm font-semibold shadow-md shadow-emerald-200 transition-all cursor-pointer"
          >
            <Plus size={16} />
            <span>{t('addCattle') || 'Add Cattle'}</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 md:gap-5">
        <div className="bg-white p-4 md:p-5 rounded-2xl border border-slate-100 shadow-soft">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Cattle</span>
            <span className="text-lg">🐄</span>
          </div>
          <p className="text-2xl md:text-3xl font-display font-black text-slate-900">{stats.total}</p>
          <p className="text-[11px] text-slate-500 font-medium mt-1">
            {stats.cows} {t('cow') || 'Cows'} • {stats.buffaloes} {t('buffalo') || 'Buffaloes'}
          </p>
        </div>

        <div className="bg-white p-4 md:p-5 rounded-2xl border border-slate-100 shadow-soft">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Cows</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">Cow</span>
          </div>
          <p className="text-2xl md:text-3xl font-display font-black text-blue-700">{stats.cows}</p>
          <p className="text-[11px] text-slate-500 font-medium mt-1">Registered dairy cows</p>
        </div>

        <div className="bg-white p-4 md:p-5 rounded-2xl border border-slate-100 shadow-soft">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Buffaloes</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-purple-50 text-purple-600">Buffalo</span>
          </div>
          <p className="text-2xl md:text-3xl font-display font-black text-purple-700">{stats.buffaloes}</p>
          <p className="text-[11px] text-slate-500 font-medium mt-1">Registered buffaloes</p>
        </div>

        <div className="bg-white p-4 md:p-5 rounded-2xl border border-slate-100 shadow-soft">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Vaccinations</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600">Total Doses</span>
          </div>
          <p className="text-2xl md:text-3xl font-display font-black text-emerald-700">{stats.totalVaccines}</p>
          <p className="text-[11px] text-slate-500 font-medium mt-1">
            {stats.upcomingDues > 0 ? `${stats.upcomingDues} booster doses scheduled` : 'All records up to date'}
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-soft flex flex-wrap items-center justify-between gap-3">
        <div className="flex-1 min-w-[240px] relative">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by cattle name, farmer..."
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Type Filter */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as any)}
            className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs md:text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="all">{t('allCattle') ? t('allCattle') + ' (Cow & Buffalo)' : 'All Types (Cow & Buffalo)'}</option>
            <option value="cow">🐄 {t('cow') || 'Cow'}</option>
            <option value="buffalo">🐃 {t('buffalo') || 'Buffalo'}</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs md:text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="all">{t('status') ? t('status') + ' - All' : 'All Statuses'}</option>
            <option value="active">{t('active') || 'Active'}</option>
            <option value="lactating">{t('lactating') || 'Lactating'}</option>
            <option value="dry">{t('dry') || 'Dry'}</option>
            <option value="pregnant">{t('pregnant') || 'Pregnant'}</option>
            <option value="sold">{t('sold') || 'Sold'}</option>
          </select>

          {/* Farmer Selector for Admin/Vendor */}
          {(isAdmin || isVendor) && customers.length > 0 && (
            <select
              value={selectedCustomerFilter}
              onChange={(e) => setSelectedCustomerFilter(e.target.value)}
              className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs md:text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 max-w-[180px] truncate"
            >
              <option value="all">All Farmers</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.customer_code ? `${c.customer_code} - ` : ''}{c.name}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Cattle Cards Grid */}
      {isLoading ? (
        <div className="p-12 text-center text-slate-400 bg-white rounded-3xl border border-slate-100">
          <p className="text-sm font-semibold">Loading cattle and vaccination records...</p>
        </div>
      ) : filteredCattle.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-3xl border border-slate-100 shadow-soft">
          <div className="w-16 h-16 rounded-full bg-slate-50 text-slate-400 flex items-center justify-center mx-auto mb-3">
            <ShieldCheck size={32} />
          </div>
          <h3 className="text-base font-bold text-slate-800">
            {searchQuery || typeFilter !== 'all' || statusFilter !== 'all'
              ? 'No matching cattle found'
              : t('noCattleFound') || 'No cattle registered yet'}
          </h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            Add your cows and buffaloes to start recording their vaccination dates and booster schedules.
          </p>
          <button
            onClick={handleOpenAddCattle}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer"
          >
            <Plus size={14} />
            <span>Add First Cattle</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCattle.map((c) => {
            const isCow = c.type === 'cow';
            return (
              <div
                key={c.id}
                className="bg-white rounded-3xl border border-slate-100 p-5 shadow-soft hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div>
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shadow-inner ${
                          isCow ? 'bg-amber-50 text-amber-600' : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {isCow ? '🐄' : '🐃'}
                      </div>
                      <div>
                        <h4 className="text-base font-bold text-slate-900 leading-tight">
                          {c.name || (isCow ? 'Cow' : 'Buffalo')}
                        </h4>
                        <div className="flex items-center gap-2 mt-1">
                          <span
                            className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                              isCow ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'
                            }`}
                          >
                            {isCow ? 'Cow' : 'Buffalo'}
                          </span>
                          <span
                            className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                              c.status === 'active'
                                ? 'bg-emerald-50 text-emerald-700'
                                : c.status === 'lactating'
                                ? 'bg-cyan-50 text-cyan-700'
                                : c.status === 'pregnant'
                                ? 'bg-pink-50 text-pink-700'
                                : c.status === 'dry'
                                ? 'bg-amber-50 text-amber-700'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {c.status}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenEditCattle(c)}
                        className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
                        title="Edit Cattle Profile"
                      >
                        <Edit2 size={15} />
                      </button>
                      <button
                        onClick={() => handleDeleteCattle(c.id, c.name)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                        title="Delete Cattle"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>

                  {/* Details */}
                  <div className="space-y-1.5 text-xs text-slate-600 border-t border-slate-50 pt-3 mb-4">
                    {(isAdmin || isVendor) && (
                      <div className="flex justify-between">
                        <span className="text-slate-400">Farmer:</span>
                        <span className="font-semibold text-slate-800">
                          {c.customer_name || 'Farmer #' + c.customer_id}
                          {c.customer_code ? ` (${c.customer_code})` : ''}
                        </span>
                      </div>
                    )}

                    {c.dob && (
                      <div className="flex justify-between">
                        <span className="text-slate-400">DOB / Age:</span>
                        <span className="font-medium text-slate-700">{c.dob}</span>
                      </div>
                    )}

                    <div className="flex justify-between">
                      <span className="text-slate-400">Total Vaccinations:</span>
                      <span className="font-bold text-emerald-600">
                        {c.vaccination_count || 0} recorded
                      </span>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-slate-400">Last Vaccinated:</span>
                      <span className="font-medium text-slate-800">
                        {c.last_vaccination_date ? c.last_vaccination_date : 'No records yet'}
                      </span>
                    </div>

                    {c.next_due_date && (
                      <div className="flex justify-between items-center text-amber-700 bg-amber-50 px-2 py-1 rounded-lg mt-1">
                        <span className="flex items-center gap-1 font-semibold text-[11px]">
                          <Clock size={12} /> Next Booster Due:
                        </span>
                        <span className="font-bold text-[11px]">{c.next_due_date}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-2 pt-2 border-t border-slate-50">
                  <button
                    onClick={() => handleOpenLogVaccine(c)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
                  >
                    <Syringe size={14} />
                    <span>Log Vaccine</span>
                  </button>

                  <button
                    onClick={() => handleOpenHistory(c)}
                    className="flex items-center justify-center gap-1 py-2 px-3 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold transition-all cursor-pointer"
                  >
                    <FileText size={14} />
                    <span>History ({c.vaccination_count || 0})</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ─── MODAL: Add / Edit Cattle ────────────────────────────────────────── */}
      <AnimatePresence>
        {isCattleModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl border border-slate-100"
            >
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="text-xl">🐄</span>
                  <h3 className="text-lg font-display font-bold text-slate-900">
                    {editingCattle ? (t('editCattle') || 'Edit Cattle Profile') : (t('addCattle') || 'Add New Cattle')}
                  </h3>
                </div>
                <button
                  onClick={() => setIsCattleModalOpen(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-50"
                >
                  <X size={18} />
                </button>
              </div>

              {formError && (
                <div className="mt-4 p-3 bg-rose-50 text-rose-700 text-xs font-semibold rounded-xl border border-rose-100 flex items-center gap-2">
                  <AlertCircle size={16} />
                  <span>{formError}</span>
                </div>
              )}

              <form onSubmit={handleCattleSubmit} className="mt-4 space-y-4">
                {(isAdmin || isVendor) && (
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                      Farmer <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={cattleForm.customer_id}
                      onChange={(e) => setCattleForm({ ...cattleForm, customer_id: e.target.value })}
                      required
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="">Select Farmer</option>
                      {customers.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.customer_code ? `[${c.customer_code}] ` : ''}{c.name} ({c.phone || 'No phone'})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                    {t('cattleName') || 'Cattle Name / Identifier'}
                  </label>
                  <input
                    type="text"
                    value={cattleForm.name}
                    onChange={(e) => setCattleForm({ ...cattleForm, name: e.target.value })}
                    placeholder="e.g. Gauri, Lakshmi, Cow #1"
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                      {t('cattleType') || 'Animal Type'} <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={cattleForm.type}
                      onChange={(e) => setCattleForm({ ...cattleForm, type: e.target.value as CattleType })}
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="cow">🐄 {t('cow') || 'Cow'}</option>
                      <option value="buffalo">🐃 {t('buffalo') || 'Buffalo'}</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                      {t('status') || 'Status'}
                    </label>
                    <select
                      value={cattleForm.status}
                      onChange={(e) => setCattleForm({ ...cattleForm, status: e.target.value as CattleStatus })}
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="active">{t('active') || 'Active'}</option>
                      <option value="lactating">{t('lactating') || 'Lactating'}</option>
                      <option value="pregnant">{t('pregnant') || 'Pregnant'}</option>
                      <option value="dry">{t('dry') || 'Dry'}</option>
                      <option value="sold">{t('sold') || 'Sold'}</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                    {t('dobAge') || 'Date of Birth / Age'}
                  </label>
                  <input
                    type="text"
                    value={cattleForm.dob}
                    onChange={(e) => setCattleForm({ ...cattleForm, dob: e.target.value })}
                    placeholder="e.g. 2022-04-15 or 3 Years"
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsCattleModalOpen(false)}
                    className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                  >
                    {t('cancel') || 'Cancel'}
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-md shadow-emerald-200 transition-all cursor-pointer"
                  >
                    {isSubmitting ? (t('saving') || 'Saving...') : editingCattle ? (t('updateCattle') || 'Update Cattle') : (t('saveCattle') || 'Save Cattle')}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ─── MODAL: Log / Edit Vaccination Date ───────────────────────────────── */}
      <AnimatePresence>
        {isVaccineModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl border border-slate-100"
            >
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <Syringe size={18} />
                  </div>
                  <h3 className="text-lg font-display font-bold text-slate-900">
                    {editingVaccine ? (t('editVaccination') || 'Edit Vaccination Date') : (t('logVaccination') || 'Record Vaccination Date')}
                  </h3>
                </div>
                <button
                  onClick={() => setIsVaccineModalOpen(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-50"
                >
                  <X size={18} />
                </button>
              </div>

              {formError && (
                <div className="mt-4 p-3 bg-rose-50 text-rose-700 text-xs font-semibold rounded-xl border border-rose-100 flex items-center gap-2">
                  <AlertCircle size={16} />
                  <span>{formError}</span>
                </div>
              )}

              <form onSubmit={handleVaccineSubmit} className="mt-4 space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                    Select Cattle <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={vaccineForm.cattle_id}
                    onChange={(e) => {
                      const sel = cattleList.find((c) => String(c.id) === e.target.value);
                      setVaccineForm({
                        ...vaccineForm,
                        cattle_id: e.target.value,
                        customer_id: sel ? String(sel.customer_id) : vaccineForm.customer_id,
                      });
                    }}
                    required
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="">Select Cattle</option>
                    {cattleList.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.type === 'cow' ? '🐄 ' : '🐃 '}
                        {c.name || 'Unnamed'} {c.customer_name ? `(${c.customer_name})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                      {t('vaccinationDate') || 'Vaccination Date'} <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={vaccineForm.vaccination_date}
                      onChange={(e) => setVaccineForm({ ...vaccineForm, vaccination_date: e.target.value })}
                      required
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                      {t('nextDueDate') || 'Next Due Date'}
                    </label>
                    <input
                      type="date"
                      value={vaccineForm.next_due_date}
                      onChange={(e) => setVaccineForm({ ...vaccineForm, next_due_date: e.target.value })}
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                    {t('administeredBy') || 'Administered By (Doctor / Center)'}
                  </label>
                  <input
                    type="text"
                    value={vaccineForm.administered_by}
                    onChange={(e) => setVaccineForm({ ...vaccineForm, administered_by: e.target.value })}
                    placeholder="e.g. Dr. Ramesh / Govt Veterinary Hospital"
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                    {t('notes') || 'Notes / Details'}
                  </label>
                  <textarea
                    rows={2}
                    value={vaccineForm.notes}
                    onChange={(e) => setVaccineForm({ ...vaccineForm, notes: e.target.value })}
                    placeholder="Vaccine name (e.g. FMD, HS, Brucellosis), batch number or notes..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsVaccineModalOpen(false)}
                    className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-md shadow-emerald-200 transition-all cursor-pointer"
                  >
                    {isSubmitting ? 'Saving...' : editingVaccine ? 'Update Record' : 'Save Record'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ─── MODAL: Cattle Vaccination History Timeline ──────────────────────── */}
      <AnimatePresence>
        {isHistoryModalOpen && activeCattleForHistory && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-6 w-full max-w-xl shadow-2xl border border-slate-100 max-h-[85vh] flex flex-col"
            >
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">
                    {activeCattleForHistory.type === 'cow' ? '🐄' : '🐃'}
                  </span>
                  <div>
                    <h3 className="text-base md:text-lg font-display font-bold text-slate-900">
                      {activeCattleForHistory.name || 'Cattle'} — Vaccination History
                    </h3>
                    <p className="text-xs text-slate-500">
                      {activeCattleForHistory.type === 'cow' ? 'Cow' : 'Buffalo'}
                      {activeCattleForHistory.customer_name ? ` • Farmer: ${activeCattleForHistory.customer_name}` : ''}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setIsHistoryModalOpen(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-50"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Vaccination Timeline List */}
              <div className="flex-1 overflow-y-auto py-4 space-y-3">
                {(() => {
                  const cattleVaccines = vaccinations.filter(
                    (v) => String(v.cattle_id) === String(activeCattleForHistory.id)
                  );

                  if (cattleVaccines.length === 0) {
                    return (
                      <div className="p-8 text-center text-slate-400">
                        <Syringe size={28} className="mx-auto mb-2 opacity-50" />
                        <p className="text-xs font-semibold">No vaccination dates recorded yet.</p>
                      </div>
                    );
                  }

                  return cattleVaccines.map((v, idx) => (
                    <div
                      key={v.id}
                      className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex items-start justify-between gap-3"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 font-bold text-xs">
                          #{cattleVaccines.length - idx}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-800">
                              Vaccinated on: {v.vaccination_date}
                            </span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
                              Completed
                            </span>
                          </div>

                          {v.next_due_date && (
                            <p className="text-xs text-amber-700 font-semibold mt-1">
                              Next Booster Due: {v.next_due_date}
                            </p>
                          )}

                          {v.administered_by && (
                            <p className="text-[11px] text-slate-600 mt-0.5">
                              Administered by: <span className="font-medium">{v.administered_by}</span>
                            </p>
                          )}

                          {v.notes && (
                            <p className="text-[11px] text-slate-500 mt-1 italic">
                              "{v.notes}"
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => {
                            setIsHistoryModalOpen(false);
                            handleOpenEditVaccine(v);
                          }}
                          className="p-1 text-slate-400 hover:text-slate-700 rounded-lg transition-colors cursor-pointer"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          onClick={() => handleDeleteVaccine(v.id)}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded-lg transition-colors cursor-pointer"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ));
                })()}
              </div>

              {/* Modal Footer */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <button
                  onClick={() => {
                    setIsHistoryModalOpen(false);
                    handleOpenLogVaccine(activeCattleForHistory);
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
                >
                  <Plus size={14} />
                  <span>Log New Vaccination</span>
                </button>

                <button
                  onClick={() => setIsHistoryModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
