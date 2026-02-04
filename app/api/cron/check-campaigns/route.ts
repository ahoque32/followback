import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// For cron jobs, we use a service role client that bypasses RLS
// This is safe because the endpoint is protected by CRON_SECRET
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

interface Campaign {
  id: string;
  business_id: string;
  name: string;
  trigger_days: number;
  channel: string;
  template: string;
  discount_percent: number;
}

interface Customer {
  id: string;
  business_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  last_visit: string;
}

interface ProcessResult {
  campaignId: string;
  campaignName: string;
  customersProcessed: number;
  emailsSent: number;
  smsSent: number;
  errors: string[];
}

export async function POST(request: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get('authorization');
    const expectedAuth = `Bearer ${process.env.CRON_SECRET}`;
    
    if (authHeader !== expectedAuth) {
      console.error('Unauthorized cron request');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Create Supabase service role client
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch all active campaigns
    const { data: campaigns, error: campaignsError } = await supabase
      .from('campaigns')
      .select('*')
      .eq('active', true);

    if (campaignsError) {
      console.error('Error fetching campaigns:', campaignsError);
      return NextResponse.json(
        { error: 'Failed to fetch campaigns', details: campaignsError.message },
        { status: 500 }
      );
    }

    if (!campaigns || campaigns.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No active campaigns to process',
        results: [],
      });
    }

    console.log(`Processing ${campaigns.length} active campaigns`);

    const results: ProcessResult[] = [];

    // Process each campaign sequentially
    for (const campaign of campaigns as Campaign[]) {
      const result: ProcessResult = {
        campaignId: campaign.id,
        campaignName: campaign.name,
        customersProcessed: 0,
        emailsSent: 0,
        smsSent: 0,
        errors: [],
      };

      try {
        // Find customers who match the trigger criteria
        // 1. Last visit is older than trigger_days
        // 2. Not opted out
        // 3. Haven't been messaged by this campaign yet
        const { data: customers, error: customersError } = await supabase
          .from('customers')
          .select(`
            id,
            business_id,
            name,
            email,
            phone,
            last_visit
          `)
          .eq('business_id', campaign.business_id)
          .eq('opt_out', false)
          .lt('last_visit', new Date(Date.now() - campaign.trigger_days * 24 * 60 * 60 * 1000).toISOString())
          .limit(100); // Rate limit: max 100 per campaign per run

        if (customersError) {
          console.error(`Error fetching customers for campaign ${campaign.id}:`, customersError);
          result.errors.push(`Failed to fetch customers: ${customersError.message}`);
          results.push(result);
          continue;
        }

        if (!customers || customers.length === 0) {
          console.log(`No customers to message for campaign ${campaign.name}`);
          results.push(result);
          continue;
        }

        // Filter out customers who have already been messaged by this campaign
        const customerIds = customers.map((c: Customer) => c.id);
        
        const { data: existingMessages, error: messagesError } = await supabase
          .from('messages')
          .select('customer_id')
          .eq('campaign_id', campaign.id)
          .in('customer_id', customerIds);

        if (messagesError) {
          console.error(`Error checking existing messages for campaign ${campaign.id}:`, messagesError);
          result.errors.push(`Failed to check existing messages: ${messagesError.message}`);
          results.push(result);
          continue;
        }

        const alreadyMessagedIds = new Set(
          existingMessages?.map((m: { customer_id: string }) => m.customer_id) || []
        );

        const customersToMessage = (customers as Customer[]).filter(
          (c) => !alreadyMessagedIds.has(c.id)
        );

        if (customersToMessage.length === 0) {
          console.log(`All eligible customers already messaged for campaign ${campaign.name}`);
          results.push(result);
          continue;
        }

        console.log(`Sending to ${customersToMessage.length} customers for campaign ${campaign.name}`);

        // Fetch business information for template interpolation
        const { data: business } = await supabase
          .from('businesses')
          .select('name')
          .eq('id', campaign.business_id)
          .single();

        const businessName = business?.name || 'Our Business';

        // Process each customer
        for (const customer of customersToMessage) {
          result.customersProcessed++;

          // Prepare template variables
          const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
          const trackingLink = `${baseUrl}/book?bid=${campaign.business_id}&cid=${customer.id}`;

          // Interpolate template
          const message = campaign.template
            .replace(/{name}/g, customer.name || 'Valued Customer')
            .replace(/{business}/g, businessName)
            .replace(/{discount}/g, campaign.discount_percent.toString())
            .replace(/{link}/g, trackingLink);

          // Send based on channel
          const channels: string[] = [];
          if (campaign.channel === 'both') {
            channels.push('email', 'sms');
          } else {
            channels.push(campaign.channel);
          }

          for (const channel of channels) {
            try {
              if (channel === 'email' && customer.email) {
                // Call send-email API
                const emailResponse = await fetch(`${baseUrl}/api/send-email`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    customerId: customer.id,
                    campaignId: campaign.id,
                    to: customer.email,
                    customerName: customer.name,
                    businessName: businessName,
                    discount: campaign.discount_percent.toString(),
                    trackingLink: trackingLink,
                    message: message,
                    subject: `Special offer from ${businessName}!`,
                  }),
                });

                if (emailResponse.ok) {
                  result.emailsSent++;
                  console.log(`Email sent to ${customer.email} for campaign ${campaign.name}`);
                } else {
                  const errorData = await emailResponse.json();
                  result.errors.push(
                    `Email failed for ${customer.email}: ${errorData.error || 'Unknown error'}`
                  );
                  console.error(`Email failed for ${customer.email}:`, errorData);
                }
              } else if (channel === 'sms' && customer.phone) {
                // Call send-sms API
                const smsResponse = await fetch(`${baseUrl}/api/send-sms`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    customerId: customer.id,
                    campaignId: campaign.id,
                    message: message,
                    phoneNumber: customer.phone,
                  }),
                });

                if (smsResponse.ok) {
                  result.smsSent++;
                  console.log(`SMS sent to ${customer.phone} for campaign ${campaign.name}`);
                } else {
                  const errorData = await smsResponse.json();
                  result.errors.push(
                    `SMS failed for ${customer.phone}: ${errorData.error || 'Unknown error'}`
                  );
                  console.error(`SMS failed for ${customer.phone}:`, errorData);
                }
              } else if (channel === 'email' && !customer.email) {
                result.errors.push(`No email address for customer ${customer.name || customer.id}`);
              } else if (channel === 'sms' && !customer.phone) {
                result.errors.push(`No phone number for customer ${customer.name || customer.id}`);
              }

              // Add a small delay between sends to avoid overwhelming APIs
              await new Promise((resolve) => setTimeout(resolve, 100));
            } catch (sendError) {
              const errorMessage =
                sendError instanceof Error ? sendError.message : 'Unknown error';
              result.errors.push(`Failed to send ${channel} to customer ${customer.id}: ${errorMessage}`);
              console.error(`Send error for customer ${customer.id}:`, sendError);
            }
          }
        }
      } catch (campaignError) {
        const errorMessage =
          campaignError instanceof Error ? campaignError.message : 'Unknown error';
        result.errors.push(`Campaign processing failed: ${errorMessage}`);
        console.error(`Error processing campaign ${campaign.id}:`, campaignError);
      }

      results.push(result);
    }

    // Calculate summary
    const summary = {
      totalCampaigns: campaigns.length,
      totalCustomersProcessed: results.reduce((sum, r) => sum + r.customersProcessed, 0),
      totalEmailsSent: results.reduce((sum, r) => sum + r.emailsSent, 0),
      totalSmsSent: results.reduce((sum, r) => sum + r.smsSent, 0),
      totalErrors: results.reduce((sum, r) => sum + r.errors.length, 0),
    };

    console.log('Cron job completed:', summary);

    return NextResponse.json({
      success: true,
      summary,
      results,
    });
  } catch (error) {
    console.error('Unexpected error in check-campaigns cron:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
