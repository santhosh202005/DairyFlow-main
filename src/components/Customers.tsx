import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, X, Milk, Phone, MapPin, User } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Customer } from '../types';
import MilkEntries from './MilkEntries';
import SearchBar from './SearchBar';
import { useDebouncedValue } from '../hooks/useDebouncedValue';

export default function Customers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [historyCustomerId, setHistoryCustomerId] = useState<string | null>(null);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 400);

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    address: '',
    username: '',
    password: '',
    default_rate: 30,
    gender: 'male' as 'male' | 'female',
  });

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = () => {
    fetch('/api/customers')
      .then(res => res.json())
      .then(data => setCustomers(data));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = editingCustomer ? `/api/customers/${editingCustomer.id}` : '/api/customers';
    const method = editingCustomer ? 'PUT' : 'POST';

    await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    });

    setIsModalOpen(false);
    setEditingCustomer(null);
    setFormData({ name: '', phone: '', address: '', username: '', password: '', default_rate: 30, gender: 'male' });
    fetchCustomers();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this customer?')) return;
    await fetch(`/api/customers/${id}`, { method: 'DELETE' });
    fetchCustomers();
  };

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
    c.id.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
    c.phone.includes(debouncedSearch)
  );

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Search + Add */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex-1 sm:max-w-xs">
          <SearchBar
            value={search}
            onChange={setSearch}
            placeholder="Search customers by name or ID..."
            className="w-full"
          />
        </div>
        <button
          onClick={() => {
            setEditingCustomer(null);
            setFormData({ name: '', phone: '', address: '', username: '', password: '', default_rate: 30, gender: 'male' });
            setIsModalOpen(true);
          }}
          className="flex items-center justify-center gap-2 bg-emerald-600 text-white px-5 py-3 rounded-xl hover:bg-emerald-700 transition-colors shadow-sm font-bold text-sm touch-btn w-full sm:w-auto"
        >
          <Plus size={18} />
          Add Customer
        </button>
      </div>

      {/* Desktop/tablet table */}
      <div className="bg-white rounded-2xl shadow-soft border border-slate-100 overflow-hidden hidden sm:block">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse mobile-compact-table">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="p-3 md:p-4 font-semibold text-slate-600 text-[11px] md:text-sm uppercase tracking-wider">Name</th>
                <th className="hidden md:table-cell p-3 md:p-4 font-semibold text-slate-600 text-[11px] md:text-sm uppercase tracking-wider">Phone</th>
                <th className="hidden lg:table-cell p-3 md:p-4 font-semibold text-slate-600 text-[11px] md:text-sm uppercase tracking-wider">Rate</th>
                <th className="p-3 md:p-4 font-semibold text-slate-600 text-[11px] md:text-sm uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredCustomers.map((customer) => (
                <tr key={customer.id} className="hover:bg-slate-50 transition-colors group">
                  <td className="p-3 md:p-4 font-medium text-slate-900 text-sm leading-tight">
                    <div>
                      <p className="font-bold text-slate-900">{customer.name}</p>
                      <p className="text-xs text-slate-400 md:hidden mt-0.5">{customer.phone}</p>
                    </div>
                  </td>
                  <td className="hidden md:table-cell p-3 md:p-4 text-slate-600 text-sm">{customer.phone}</td>
                  <td className="hidden lg:table-cell p-3 md:p-4 text-slate-600 text-sm">₹{customer.default_rate || 30}/L</td>
                  <td className="p-3 md:p-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => setHistoryCustomerId(customer.id)}
                        className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors touch-btn"
                        title="View Milk History"
                      >
                        <Milk size={15} />
                      </button>
                      <button
                        onClick={() => {
                          setEditingCustomer(customer);
                          setFormData({ 
                            name: customer.name, 
                            phone: customer.phone, 
                            address: customer.address,
                            username: customer.username || '',
                            password: customer.password || '',
                            default_rate: customer.default_rate || 30,
                            gender: customer.gender || 'male',
                          });
                          setIsModalOpen(true);
                        }}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors touch-btn"
                      >
                        <Edit2 size={15} />
                      </button>
                      <button
                        onClick={() => handleDelete(customer.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors touch-btn"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredCustomers.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-8 md:p-12 text-center text-slate-400 italic text-sm">
                    No customers found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile card list */}
      <div className="sm:hidden space-y-2.5">
        {filteredCustomers.length === 0 && (
          <div className="bg-white rounded-2xl border border-slate-100 p-8 text-center">
            <div className="w-12 h-12 rounded-xl bg-slate-50 flex items-center justify-center text-slate-200 mx-auto mb-3">
              <User size={24} />
            </div>
            <p className="text-sm font-bold text-slate-400">No Customers</p>
            <p className="text-xs text-slate-300 mt-1">Tap "Add Customer" to register a farmer.</p>
          </div>
        )}
        {filteredCustomers.map((customer) => (
          <motion.div
            key={customer.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-xl border border-slate-100 p-4 shadow-soft"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 font-black text-sm flex-shrink-0">
                  {customer.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-slate-900 text-sm truncate">{customer.name}</p>
                  <div className="flex items-center gap-3 mt-0.5">
                    {customer.phone && (
                      <span className="text-[11px] text-slate-400 flex items-center gap-1">
                        <Phone size={10} />
                        {customer.phone}
                      </span>
                    )}
                    <span className="text-[11px] text-emerald-600 font-bold">₹{customer.default_rate || 30}/L</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={() => setHistoryCustomerId(customer.id)}
                  className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors touch-btn"
                >
                  <Milk size={16} />
                </button>
                <button
                  onClick={() => {
                    setEditingCustomer(customer);
                    setFormData({ 
                      name: customer.name, 
                      phone: customer.phone, 
                      address: customer.address,
                      username: customer.username || '',
                      password: customer.password || '',
                      default_rate: customer.default_rate || 30,
                      gender: customer.gender || 'male',
                    });
                    setIsModalOpen(true);
                  }}
                  className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors touch-btn"
                >
                  <Edit2 size={16} />
                </button>
                <button
                  onClick={() => handleDelete(customer.id)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors touch-btn"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 40 }}
              className="bg-white rounded-t-3xl sm:rounded-2xl shadow-xl w-full sm:max-w-md overflow-hidden"
            >
              <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mt-3 mb-1 sm:hidden" />
              <div className="p-5 border-b border-slate-100 flex justify-between items-center">
                <h3 className="text-lg font-bold text-slate-800">
                  {editingCustomer ? 'Edit Customer' : 'Add New Customer'}
                </h3>
                <button onClick={() => setIsModalOpen(false)} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-all touch-btn">
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="p-5 space-y-3.5 modal-scroll">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Full Name</label>
                  <input
                    required
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="input-base"
                    placeholder="Enter full name"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Phone Number</label>
                  <input
                    required
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="input-base"
                    placeholder="Enter phone number"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Address</label>
                  <textarea
                    required
                    rows={2}
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="input-base resize-none"
                    placeholder="Enter address"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Username</label>
                    <input
                      required
                      type="text"
                      value={formData.username}
                      onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                      className="input-base"
                      placeholder="Username"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Password</label>
                    <input
                      required
                      type="text"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className="input-base"
                      placeholder="Password"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Gender</label>
                  <select
                    value={formData.gender}
                    onChange={(e) => setFormData({ ...formData, gender: e.target.value as 'male' | 'female' })}
                    className="input-base"
                  >
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Default Milk Rate (₹/L)</label>
                  <input
                    required
                    type="number"
                    step="0.1"
                    value={formData.default_rate}
                    onChange={(e) => setFormData({ ...formData, default_rate: parseFloat(e.target.value) })}
                    className="input-base"
                  />
                </div>
                <div className="pt-2">
                  <button
                    type="submit"
                    className="w-full bg-emerald-600 text-white py-3.5 rounded-xl font-bold hover:bg-emerald-700 transition-colors shadow-md text-sm touch-btn"
                  >
                    {editingCustomer ? 'Update Customer' : 'Save Customer'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* History Modal */}
      {historyCustomerId && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[92vh] overflow-hidden flex flex-col"
          >
            <div className="p-4 md:p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div>
                <h3 className="text-base md:text-xl font-bold text-slate-800">
                  {customers.find(c => c.id === historyCustomerId)?.name}
                </h3>
                <p className="text-xs text-slate-500">Milk supply history</p>
              </div>
              <button 
                onClick={() => setHistoryCustomerId(null)} 
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-full transition-all touch-btn"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-4 md:p-6 overflow-y-auto flex-1">
              <MilkEntries customerId={historyCustomerId} isAdmin={true} />
            </div>
            <div className="p-3 md:p-4 border-t border-slate-100 bg-slate-50 text-right">
              <button 
                onClick={() => setHistoryCustomerId(null)}
                className="px-5 py-2.5 bg-slate-200 text-slate-700 rounded-xl font-bold hover:bg-slate-300 transition-all text-sm touch-btn"
              >
                Close
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
