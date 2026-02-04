'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useSupabase } from '@/lib/supabase';
import Papa from 'papaparse';

interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  last_visit: string | null;
  visit_count: number;
  total_spent: number;
  tags: string[];
  created_at: string;
}

interface CSVRow {
  name?: string;
  Name?: string;
  email?: string;
  Email?: string;
  phone?: string;
  Phone?: string;
  last_visit?: string;
  'Last Visit'?: string;
  visit_count?: string;
  'Visit Count'?: string;
  total_spent?: string;
  'Total Spent'?: string;
}

export default function CustomersPage() {
  const supabase = useSupabase();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState<string>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form state for adding customer
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    last_visit: '',
    visit_count: 0,
    total_spent: 0,
  });

  // Auto-tag logic
  const calculateTags = (lastVisit: string | null): string[] => {
    if (!lastVisit) return [];
    
    const lastVisitDate = new Date(lastVisit);
    const today = new Date();
    const daysSinceVisit = Math.floor((today.getTime() - lastVisitDate.getTime()) / (1000 * 60 * 60 * 24));
    
    const tags: string[] = [];
    if (daysSinceVisit >= 30) {
      tags.push('lost');
    } else if (daysSinceVisit >= 14) {
      tags.push('at-risk');
    }
    
    return tags;
  };

  // Fetch customers
  const fetchCustomers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('customers')
        .select('*')
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      // Add auto-tags to each customer
      const customersWithTags = (data || []).map(customer => ({
        ...customer,
        tags: calculateTags(customer.last_visit),
      }));

      setCustomers(customersWithTags);
      setFilteredCustomers(customersWithTags);
    } catch (err) {
      console.error('Error fetching customers:', err);
      setError(err instanceof Error ? err.message : 'Failed to load customers');
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  // Apply filters
  useEffect(() => {
    let filtered = [...customers];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(customer =>
        customer.name.toLowerCase().includes(query) ||
        customer.email.toLowerCase().includes(query) ||
        customer.phone.toLowerCase().includes(query)
      );
    }

    // Date filter
    if (dateFilter !== 'all') {
      const today = new Date();
      filtered = filtered.filter(customer => {
        if (!customer.last_visit) return false;
        
        const lastVisitDate = new Date(customer.last_visit);
        const daysSinceVisit = Math.floor((today.getTime() - lastVisitDate.getTime()) / (1000 * 60 * 60 * 24));
        
        switch (dateFilter) {
          case '7days':
            return daysSinceVisit <= 7;
          case '14days':
            return daysSinceVisit <= 14;
          case '30days':
            return daysSinceVisit <= 30;
          case 'over30':
            return daysSinceVisit > 30;
          default:
            return true;
        }
      });
    }

    setFilteredCustomers(filtered);
  }, [searchQuery, dateFilter, customers]);

  // Add customer manually
  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setError(null);
      
      const { error: insertError } = await supabase
        .from('customers')
        .insert([{
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          last_visit: formData.last_visit || null,
          visit_count: formData.visit_count,
          total_spent: formData.total_spent,
        }]);

      if (insertError) throw insertError;

      // Reset form and close modal
      setFormData({
        name: '',
        email: '',
        phone: '',
        last_visit: '',
        visit_count: 0,
        total_spent: 0,
      });
      setShowAddModal(false);
      
      // Refresh customers list
      fetchCustomers();
    } catch (err) {
      console.error('Error adding customer:', err);
      setError(err instanceof Error ? err.message : 'Failed to add customer');
    }
  };

  // Handle CSV upload
  const handleCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          // Map CSV rows to customer objects
          const customersToInsert = (results.data as CSVRow[]).map((row) => ({
            name: row.name || row.Name || '',
            email: row.email || row.Email || '',
            phone: row.phone || row.Phone || '',
            last_visit: row.last_visit || row['Last Visit'] || null,
            visit_count: parseInt(row.visit_count || row['Visit Count'] || '0'),
            total_spent: parseFloat(row.total_spent || row['Total Spent'] || '0'),
          })).filter(customer => customer.name && customer.email);

          if (customersToInsert.length === 0) {
            throw new Error('No valid customers found in CSV');
          }

          const { error: insertError } = await supabase
            .from('customers')
            .insert(customersToInsert);

          if (insertError) throw insertError;

          alert(`Successfully imported ${customersToInsert.length} customers`);
          fetchCustomers();
        } catch (err) {
          console.error('Error importing CSV:', err);
          setError(err instanceof Error ? err.message : 'Failed to import CSV');
        } finally {
          setUploading(false);
          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }
        }
      },
      error: (err) => {
        console.error('CSV parse error:', err);
        setError('Failed to parse CSV file');
        setUploading(false);
      },
    });
  };

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  // Format date
  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // Get tag badge color
  const getTagColor = (tag: string) => {
    switch (tag) {
      case 'VIP':
        return 'bg-purple-100 text-purple-800';
      case 'at-risk':
        return 'bg-yellow-100 text-yellow-800';
      case 'lost':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="p-6 lg:p-8">
        <div className="max-w-7xl mx-auto">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6 animate-pulse"></div>
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-16 bg-gray-100 rounded animate-pulse"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Customers</h1>
          <p className="mt-2 text-gray-600">
            Manage your customer database and track engagement
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            <p className="font-medium">Error</p>
            <p className="text-sm mt-1">{error}</p>
          </div>
        )}

        {/* Actions Bar */}
        <div className="mb-6 bg-white rounded-lg shadow p-4">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search */}
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search by name, email, or phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Date Filter */}
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Time</option>
              <option value="7days">Last 7 Days</option>
              <option value="14days">Last 14 Days</option>
              <option value="30days">Last 30 Days</option>
              <option value="over30">Over 30 Days</option>
            </select>

            {/* Add Customer Button */}
            <button
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium whitespace-nowrap"
            >
              + Add Customer
            </button>

            {/* CSV Upload Button */}
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleCSVUpload}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium whitespace-nowrap disabled:bg-gray-400"
              >
                {uploading ? 'Uploading...' : '📤 Import CSV'}
              </button>
            </div>
          </div>
        </div>

        {/* Customers Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Phone
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Last Visit
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Visits
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total Spent
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tags
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredCustomers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                      {searchQuery || dateFilter !== 'all' 
                        ? 'No customers found matching your filters'
                        : 'No customers yet. Add your first customer to get started!'}
                    </td>
                  </tr>
                ) : (
                  filteredCustomers.map((customer) => (
                    <tr key={customer.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{customer.name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">{customer.email}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">{customer.phone}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">{formatDate(customer.last_visit)}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{customer.visit_count}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{formatCurrency(customer.total_spent)}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex gap-1">
                          {customer.tags.map((tag) => (
                            <span
                              key={tag}
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getTagColor(tag)}`}
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Customer Count */}
        <div className="mt-4 text-sm text-gray-500">
          Showing {filteredCustomers.length} of {customers.length} customers
        </div>

        {/* Add Customer Modal */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
              <div className="p-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">Add New Customer</h2>
                
                <form onSubmit={handleAddCustomer} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email *
                    </label>
                    <input
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Phone *
                    </label>
                    <input
                      type="tel"
                      required
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Last Visit
                    </label>
                    <input
                      type="date"
                      value={formData.last_visit}
                      onChange={(e) => setFormData({ ...formData, last_visit: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Visit Count
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formData.visit_count}
                      onChange={(e) => setFormData({ ...formData, visit_count: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Total Spent ($)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.total_spent}
                      onChange={(e) => setFormData({ ...formData, total_spent: parseFloat(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div className="flex gap-3 mt-6">
                    <button
                      type="button"
                      onClick={() => setShowAddModal(false)}
                      className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                    >
                      Add Customer
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
