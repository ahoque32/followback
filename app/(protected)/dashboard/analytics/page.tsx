'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSupabase } from '@/lib/supabase';
import StatCard from '@/components/StatCard';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface MessageStats {
  date: string;
  count: number;
}

interface AnalyticsData {
  totalMessages: number;
  openRate: number;
  clickRate: number;
  recoveredCustomers: number;
  recoveredRevenue: number;
  messagesByDay: MessageStats[];
}

export default function AnalyticsPage() {
  const supabase = useSupabase();
  const [analytics, setAnalytics] = useState<AnalyticsData>({
    totalMessages: 0,
    openRate: 0,
    clickRate: 0,
    recoveredCustomers: 0,
    recoveredRevenue: 0,
    messagesByDay: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Date range: past 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const thirtyDaysAgoStr = thirtyDaysAgo.toISOString();

      // Fetch all messages from past 30 days
      const { data: messages, error: messagesError } = await supabase
        .from('messages')
        .select('sent_at, opened_at, clicked_at, customer_id')
        .gte('sent_at', thirtyDaysAgoStr)
        .not('sent_at', 'is', null);

      if (messagesError) throw messagesError;

      const messagesList = messages || [];
      const totalMessages = messagesList.length;

      // Calculate open and click rates
      const openedMessages = messagesList.filter(m => m.opened_at !== null).length;
      const clickedMessages = messagesList.filter(m => m.clicked_at !== null).length;
      
      const openRate = totalMessages > 0 ? Math.round((openedMessages / totalMessages) * 100) : 0;
      const clickRate = totalMessages > 0 ? Math.round((clickedMessages / totalMessages) * 100) : 0;

      // Group messages by day for the chart
      const messagesByDayMap = new Map<string, number>();
      
      // Initialize all days in the range with 0
      for (let i = 29; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        messagesByDayMap.set(dateStr, 0);
      }

      // Count messages per day
      messagesList.forEach(message => {
        if (message.sent_at) {
          const dateStr = message.sent_at.split('T')[0];
          const currentCount = messagesByDayMap.get(dateStr) || 0;
          messagesByDayMap.set(dateStr, currentCount + 1);
        }
      });

      // Convert to array for chart
      const messagesByDay = Array.from(messagesByDayMap.entries())
        .map(([date, count]) => ({
          date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          count,
        }));

      // Fetch customers who received messages
      const customerIds = Array.from(new Set(messagesList.map(m => m.customer_id)));
      
      let recoveredCustomers = 0;
      let recoveredRevenue = 0;

      if (customerIds.length > 0) {
        // Fetch customers data
        const { data: customers, error: customersError } = await supabase
          .from('customers')
          .select('id, last_visit, total_spent')
          .in('id', customerIds);

        if (customersError) throw customersError;

        // For each customer, find their earliest message sent_at
        const customerFirstMessageMap = new Map<string, Date>();
        messagesList.forEach(message => {
          const customerId = message.customer_id;
          const sentAt = new Date(message.sent_at);
          
          if (!customerFirstMessageMap.has(customerId) || sentAt < customerFirstMessageMap.get(customerId)!) {
            customerFirstMessageMap.set(customerId, sentAt);
          }
        });

        // Check which customers visited after receiving a message (recovered)
        (customers || []).forEach(customer => {
          if (customer.last_visit) {
            const lastVisitDate = new Date(customer.last_visit);
            const firstMessageDate = customerFirstMessageMap.get(customer.id);
            
            // Customer is recovered if they visited AFTER receiving a campaign message
            if (firstMessageDate && lastVisitDate > firstMessageDate) {
              recoveredCustomers++;
              recoveredRevenue += customer.total_spent || 0;
            }
          }
        });
      }

      setAnalytics({
        totalMessages,
        openRate,
        clickRate,
        recoveredCustomers,
        recoveredRevenue,
        messagesByDay,
      });
    } catch (err) {
      console.error('Error fetching analytics:', err);
      setError(err instanceof Error ? err.message : 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="p-6 lg:p-8">
        <div className="max-w-7xl mx-auto">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6 animate-pulse"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="bg-white rounded-lg shadow p-6 animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
                <div className="h-8 bg-gray-300 rounded w-3/4"></div>
              </div>
            ))}
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="h-64 bg-gray-100 rounded animate-pulse"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 lg:p-8">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">Analytics</h1>
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            <p className="font-medium">Error loading analytics</p>
            <p className="text-sm mt-1">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Analytics</h1>
          <p className="mt-2 text-gray-600">
            Track your campaign performance and customer recovery metrics
          </p>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
          <StatCard
            title="Messages Sent"
            value={analytics.totalMessages}
            description="Past 30 days"
            icon={
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            }
          />

          <StatCard
            title="Open Rate"
            value={`${analytics.openRate}%`}
            description="Messages opened"
            icon={
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            }
          />

          <StatCard
            title="Click Rate"
            value={`${analytics.clickRate}%`}
            description="Messages clicked"
            icon={
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
              </svg>
            }
          />

          <StatCard
            title="Customers Recovered"
            value={analytics.recoveredCustomers}
            description="Returned after campaign"
            icon={
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            }
          />

          <StatCard
            title="Revenue Recovered"
            value={formatCurrency(analytics.recoveredRevenue)}
            description="From recovered customers"
            icon={
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
          />
        </div>

        {/* Messages Sent Chart */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Messages Sent Over Time</h2>
          
          {analytics.messagesByDay.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-gray-500">
              No message data available for the past 30 days
            </div>
          ) : (
            <div className="h-64 md:h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={analytics.messagesByDay}
                  margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis 
                    dataKey="date" 
                    stroke="#6b7280"
                    style={{ fontSize: '12px' }}
                    interval="preserveStartEnd"
                  />
                  <YAxis 
                    stroke="#6b7280"
                    style={{ fontSize: '12px' }}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#fff',
                      border: '1px solid #e5e7eb',
                      borderRadius: '0.5rem',
                      padding: '8px 12px'
                    }}
                    labelStyle={{ color: '#111827', fontWeight: 600 }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="count" 
                    stroke="#2563eb" 
                    strokeWidth={2}
                    dot={{ fill: '#2563eb', r: 4 }}
                    activeDot={{ r: 6 }}
                    name="Messages Sent"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Info Section */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-blue-800">About Recovery Metrics</h3>
              <div className="mt-2 text-sm text-blue-700">
                <p>
                  <strong>Recovered customers</strong> are those who visited your business after receiving a campaign message. 
                  <strong> Revenue recovered</strong> includes all spending by these customers after their return.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
