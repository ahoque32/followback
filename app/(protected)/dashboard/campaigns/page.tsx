'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSupabase } from '@/lib/supabase';

interface Campaign {
  id: string;
  name: string;
  trigger_days: number;
  channel: string;
  template: string;
  discount_percent: number;
  active: boolean;
  created_at: string;
}

interface Business {
  id: string;
  plan_type: string;
  campaign_limit: number;
}

type CampaignChannel = 'email' | 'sms' | 'both';

// Pre-built templates
const PRE_BUILT_TEMPLATES = [
  {
    name: 'We miss you',
    trigger_days: 14,
    channel: 'email' as CampaignChannel,
    template: "Hi {name},\n\nWe noticed it's been a while since your last visit to {business}. We miss you!\n\nCome back soon and enjoy {discount}% off your next service.\n\nBook now: {link}\n\nSee you soon!",
    discount_percent: 10,
  },
  {
    name: 'Come back special',
    trigger_days: 30,
    channel: 'both' as CampaignChannel,
    template: "Hey {name}! 👋\n\nIt's been 30 days since we last saw you at {business}. We'd love to have you back!\n\nHere's a special {discount}% discount just for you.\n\nClick here to book: {link}\n\nLooking forward to seeing you!",
    discount_percent: 15,
  },
  {
    name: 'VIP re-engagement',
    trigger_days: 60,
    channel: 'email' as CampaignChannel,
    template: "Dear {name},\n\nAs one of our valued customers at {business}, we want to make sure you know how much we appreciate you.\n\nIt's been over 2 months since your last visit, and we'd love to welcome you back with an exclusive {discount}% VIP discount.\n\nSchedule your appointment: {link}\n\nWe look forward to serving you again soon.\n\nBest regards,\nThe {business} Team",
    discount_percent: 20,
  },
];

export default function CampaignsPage() {
  const supabase = useSupabase();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [business, setBusiness] = useState<Business | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    trigger_days: 14,
    channel: 'email' as CampaignChannel,
    template: '',
    discount_percent: 10,
  });

  // Fetch business and campaigns
  const fetchCampaigns = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch business info
      const { data: businessData, error: businessError } = await supabase
        .from('businesses')
        .select('id, plan_type, campaign_limit')
        .single();

      if (businessError) throw businessError;
      setBusiness(businessData);

      // Fetch campaigns
      const { data, error: fetchError } = await supabase
        .from('campaigns')
        .select('*')
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      setCampaigns(data || []);
    } catch (err) {
      console.error('Error fetching campaigns:', err);
      setError(err instanceof Error ? err.message : 'Failed to load campaigns');
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  // Check if at campaign limit
  const isAtLimit = () => {
    if (!business) return false;
    return campaigns.length >= business.campaign_limit;
  };

  // Create campaign
  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();

    // Check limit before creating
    if (isAtLimit()) {
      setShowCreateModal(false);
      setShowUpgradeModal(true);
      return;
    }

    try {
      setError(null);

      const { error: insertError } = await supabase
        .from('campaigns')
        .insert([{
          name: formData.name,
          trigger_days: formData.trigger_days,
          channel: formData.channel,
          template: formData.template,
          discount_percent: formData.discount_percent,
          active: true,
        }]);

      if (insertError) throw insertError;

      // Reset form and close modal
      setFormData({
        name: '',
        trigger_days: 14,
        channel: 'email',
        template: '',
        discount_percent: 10,
      });
      setShowCreateModal(false);

      // Refresh campaigns list
      fetchCampaigns();
    } catch (err) {
      console.error('Error creating campaign:', err);
      setError(err instanceof Error ? err.message : 'Failed to create campaign');
    }
  };

  // Toggle campaign active status
  const toggleCampaignActive = async (campaignId: string, currentActive: boolean) => {
    try {
      setError(null);

      const { error: updateError } = await supabase
        .from('campaigns')
        .update({ active: !currentActive })
        .eq('id', campaignId);

      if (updateError) throw updateError;

      // Update local state
      setCampaigns(campaigns.map(campaign =>
        campaign.id === campaignId
          ? { ...campaign, active: !currentActive }
          : campaign
      ));
    } catch (err) {
      console.error('Error toggling campaign:', err);
      setError(err instanceof Error ? err.message : 'Failed to toggle campaign');
    }
  };

  // Apply pre-built template
  const applyTemplate = (template: typeof PRE_BUILT_TEMPLATES[0]) => {
    setFormData({
      name: template.name,
      trigger_days: template.trigger_days,
      channel: template.channel,
      template: template.template,
      discount_percent: template.discount_percent,
    });
    setShowTemplateSelector(false);
  };

  // Insert variable into template at cursor position
  const insertVariable = (variable: string) => {
    const textarea = document.getElementById('template-textarea') as HTMLTextAreaElement;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = formData.template;
    const before = text.substring(0, start);
    const after = text.substring(end, text.length);

    setFormData({
      ...formData,
      template: before + variable + after,
    });

    // Set cursor position after inserted variable
    setTimeout(() => {
      textarea.selectionStart = textarea.selectionEnd = start + variable.length;
      textarea.focus();
    }, 0);
  };

  // Get channel badge color
  const getChannelColor = (channel: string) => {
    switch (channel) {
      case 'email':
        return 'bg-blue-100 text-blue-800';
      case 'sms':
        return 'bg-green-100 text-green-800';
      case 'both':
        return 'bg-purple-100 text-purple-800';
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
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-24 bg-gray-100 rounded animate-pulse"></div>
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
          <h1 className="text-3xl font-bold text-gray-900">Campaigns</h1>
          <p className="mt-2 text-gray-600">
            Create automated win-back campaigns to re-engage lost customers
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            <p className="font-medium">Error</p>
            <p className="text-sm mt-1">{error}</p>
          </div>
        )}

        {/* Limit Warning Banner */}
        {business && campaigns.length >= business.campaign_limit && (
          <div className="mb-6 bg-orange-50 border border-orange-200 text-orange-800 px-4 py-3 rounded-lg">
            <div className="flex items-start">
              <div className="flex-1">
                <p className="font-medium">Campaign limit reached</p>
                <p className="text-sm mt-1">
                  You&apos;ve reached your {business.plan_type} plan limit of {business.campaign_limit} campaigns. 
                  Upgrade to create more campaigns.
                </p>
              </div>
              <button
                onClick={() => setShowUpgradeModal(true)}
                className="ml-4 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors text-sm font-medium whitespace-nowrap"
              >
                Upgrade Plan
              </button>
            </div>
          </div>
        )}

        {/* Actions Bar */}
        <div className="mb-6 flex items-center justify-between">
          <button
            onClick={() => {
              if (isAtLimit()) {
                setShowUpgradeModal(true);
              } else {
                setShowCreateModal(true);
              }
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            + Create Campaign
          </button>
          {business && (
            <div className={`text-sm font-medium ${
              campaigns.length >= business.campaign_limit * 0.9 
                ? 'text-orange-600' 
                : 'text-gray-600'
            }`}>
              {campaigns.length} / {business.campaign_limit} campaigns used
              {campaigns.length >= business.campaign_limit && (
                <span className="ml-2 text-red-600 font-bold">— Limit reached!</span>
              )}
            </div>
          )}
        </div>

        {/* Campaigns List */}
        <div className="space-y-4">
          {campaigns.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-8 text-center">
              <p className="text-gray-500 mb-4">
                No campaigns yet. Create your first campaign to start winning back customers!
              </p>
              <button
                onClick={() => {
                  if (isAtLimit()) {
                    setShowUpgradeModal(true);
                  } else {
                    setShowCreateModal(true);
                  }
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                Create Your First Campaign
              </button>
            </div>
          ) : (
            campaigns.map((campaign) => (
              <div
                key={campaign.id}
                className="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-xl font-semibold text-gray-900">
                        {campaign.name}
                      </h3>
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getChannelColor(
                          campaign.channel
                        )}`}
                      >
                        {campaign.channel}
                      </span>
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          campaign.active
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {campaign.active ? 'Active' : 'Inactive'}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                      <div>
                        <p className="text-sm text-gray-500">Trigger</p>
                        <p className="text-sm font-medium text-gray-900">
                          {campaign.trigger_days} days since last visit
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Discount</p>
                        <p className="text-sm font-medium text-gray-900">
                          {campaign.discount_percent}% off
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Created</p>
                        <p className="text-sm font-medium text-gray-900">
                          {new Date(campaign.created_at).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </p>
                      </div>
                    </div>

                    <div>
                      <p className="text-sm text-gray-500 mb-1">Message Template</p>
                      <div className="bg-gray-50 rounded p-3 text-sm text-gray-700 whitespace-pre-wrap">
                        {campaign.template}
                      </div>
                    </div>
                  </div>

                  <div className="ml-4">
                    <button
                      onClick={() => toggleCampaignActive(campaign.id, campaign.active)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                        campaign.active ? 'bg-blue-600' : 'bg-gray-200'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          campaign.active ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Upgrade Modal */}
        {showUpgradeModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
              <div className="p-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">Upgrade Your Plan</h2>
                
                <p className="text-gray-600 mb-6">
                  You&apos;ve reached your {business?.plan_type || 'free'} plan limit of {business?.campaign_limit || 3} campaigns.
                  Upgrade to create more campaigns and unlock additional features.
                </p>

                <div className="space-y-3 mb-6">
                  <div className="border-2 border-blue-200 rounded-lg p-4 bg-blue-50">
                    <div className="flex justify-between items-center mb-2">
                      <h3 className="font-bold text-gray-900">Pro Plan</h3>
                      <span className="text-2xl font-bold text-gray-900">$29<span className="text-sm text-gray-600">/mo</span></span>
                    </div>
                    <ul className="text-sm text-gray-700 space-y-1">
                      <li>✓ Up to 20 campaigns</li>
                      <li>✓ 500 customers</li>
                      <li>✓ Email + SMS</li>
                    </ul>
                  </div>

                  <div className="border-2 border-purple-200 rounded-lg p-4 bg-purple-50">
                    <div className="flex justify-between items-center mb-2">
                      <h3 className="font-bold text-gray-900">Business Plan</h3>
                      <span className="text-2xl font-bold text-gray-900">$79<span className="text-sm text-gray-600">/mo</span></span>
                    </div>
                    <ul className="text-sm text-gray-700 space-y-1">
                      <li>✓ Up to 100 campaigns</li>
                      <li>✓ 2,000 customers</li>
                      <li>✓ All features</li>
                    </ul>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setShowUpgradeModal(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                  >
                    Cancel
                  </button>
                  <a
                    href="/"
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-center"
                  >
                    View Plans
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Create Campaign Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full my-8">
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-gray-900">Create Campaign</h2>
                  <button
                    onClick={() => setShowTemplateSelector(!showTemplateSelector)}
                    className="px-3 py-1.5 text-sm bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors"
                  >
                    📋 Use Template
                  </button>
                </div>

                {/* Template Selector */}
                {showTemplateSelector && (
                  <div className="mb-6 p-4 bg-purple-50 rounded-lg border border-purple-200">
                    <h3 className="text-sm font-medium text-gray-900 mb-3">
                      Pre-built Templates
                    </h3>
                    <div className="space-y-2">
                      {PRE_BUILT_TEMPLATES.map((template, index) => (
                        <button
                          key={index}
                          onClick={() => applyTemplate(template)}
                          className="w-full text-left p-3 bg-white rounded-lg hover:bg-purple-100 transition-colors border border-purple-200"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium text-gray-900">{template.name}</p>
                              <p className="text-sm text-gray-600">
                                {template.trigger_days} days • {template.channel} • {template.discount_percent}% off
                              </p>
                            </div>
                            <span className="text-purple-600">→</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <form onSubmit={handleCreateCampaign} className="space-y-6">
                  {/* Campaign Name */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Campaign Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="e.g., We miss you"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  {/* Trigger Days & Discount */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Trigger (days since last visit) *
                      </label>
                      <input
                        type="number"
                        required
                        min="1"
                        value={formData.trigger_days}
                        onChange={(e) =>
                          setFormData({ ...formData, trigger_days: parseInt(e.target.value) })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Discount Percentage *
                      </label>
                      <input
                        type="number"
                        required
                        min="0"
                        max="100"
                        value={formData.discount_percent}
                        onChange={(e) =>
                          setFormData({ ...formData, discount_percent: parseInt(e.target.value) })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>

                  {/* Channel */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Channel *
                    </label>
                    <div className="flex gap-4">
                      {(['email', 'sms', 'both'] as CampaignChannel[]).map((channel) => (
                        <label
                          key={channel}
                          className="flex items-center cursor-pointer"
                        >
                          <input
                            type="radio"
                            name="channel"
                            value={channel}
                            checked={formData.channel === channel}
                            onChange={(e) =>
                              setFormData({ ...formData, channel: e.target.value as CampaignChannel })
                            }
                            className="mr-2"
                          />
                          <span className="text-sm text-gray-700 capitalize">{channel}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Message Template */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Message Template *
                    </label>
                    <p className="text-xs text-gray-500 mb-2">
                      Use variables to personalize your message
                    </p>

                    {/* Variable Buttons */}
                    <div className="flex flex-wrap gap-2 mb-2">
                      {[
                        { label: 'Name', value: '{name}' },
                        { label: 'Business', value: '{business}' },
                        { label: 'Discount', value: '{discount}' },
                        { label: 'Link', value: '{link}' },
                      ].map((variable) => (
                        <button
                          key={variable.value}
                          type="button"
                          onClick={() => insertVariable(variable.value)}
                          className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors font-mono"
                        >
                          + {variable.value}
                        </button>
                      ))}
                    </div>

                    <textarea
                      id="template-textarea"
                      required
                      value={formData.template}
                      onChange={(e) => setFormData({ ...formData, template: e.target.value })}
                      placeholder="Hi {name}, we noticed it's been a while since your last visit to {business}..."
                      rows={8}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                    />
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-3 pt-4">
                    <button
                      type="button"
                      onClick={() => {
                        setShowCreateModal(false);
                        setShowTemplateSelector(false);
                        setFormData({
                          name: '',
                          trigger_days: 14,
                          channel: 'email',
                          template: '',
                          discount_percent: 10,
                        });
                      }}
                      className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                    >
                      Create Campaign
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
