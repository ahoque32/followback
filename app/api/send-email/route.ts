import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { render } from '@react-email/components';
import { CampaignEmail } from '@/emails/campaign-email';
import { createSupabaseServerClient } from '@/lib/supabase-server';

interface SendEmailRequest {
  customerId: string;
  campaignId: string;
  to: string;
  customerName?: string;
  businessName?: string;
  discount?: string;
  trackingLink?: string;
  message?: string;
  subject?: string;
}

export async function POST(request: NextRequest) {
  try {
    // Initialize Resend with API key
    const resend = new Resend(process.env.RESEND_API_KEY);
    
    // Parse request body
    const body: SendEmailRequest = await request.json();
    
    // Validate required fields
    if (!body.customerId || !body.campaignId || !body.to) {
      return NextResponse.json(
        { error: 'Missing required fields: customerId, campaignId, or to' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(body.to)) {
      return NextResponse.json(
        { error: 'Invalid email address' },
        { status: 400 }
      );
    }

    // Create Supabase client
    const supabase = await createSupabaseServerClient();

    // Create tracking pixel URL (we'll need to create a tracking endpoint later)
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const trackingPixelUrl = `${baseUrl}/api/track-open?messageId={MESSAGE_ID}`;

    // Generate unsubscribe link (placeholder for now)
    const unsubscribeLink = `${baseUrl}/unsubscribe?customerId=${body.customerId}&campaignId=${body.campaignId}`;

    // Insert message record first to get the message ID
    const { data: messageData, error: insertError } = await supabase
      .from('messages')
      .insert({
        customer_id: body.customerId,
        campaign_id: body.campaignId,
        channel: 'email',
        status: 'pending',
      })
      .select('id')
      .single();

    if (insertError || !messageData) {
      console.error('Error inserting message record:', insertError);
      return NextResponse.json(
        { error: 'Failed to create message record' },
        { status: 500 }
      );
    }

    const messageId = messageData.id;

    // Replace placeholder with actual message ID
    const actualTrackingPixelUrl = trackingPixelUrl.replace('{MESSAGE_ID}', messageId);

    // Render email template
    const emailHtml = await render(
      CampaignEmail({
        name: body.customerName || 'Valued Customer',
        business: body.businessName || 'Our Business',
        discount: body.discount || '20%',
        link: body.trackingLink || '#',
        message: body.message || 'We miss you! Come back and enjoy an exclusive offer.',
        unsubscribeLink,
        trackingPixelUrl: actualTrackingPixelUrl,
      })
    );

    // Send email via Resend
    const { data: emailData, error: sendError } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'FollowBack <onboarding@resend.dev>',
      to: body.to,
      subject: body.subject || `Special offer from ${body.businessName || 'us'}!`,
      html: emailHtml,
    });

    if (sendError) {
      console.error('Error sending email:', sendError);
      
      // Update message status to failed
      await supabase
        .from('messages')
        .update({ status: 'failed' })
        .eq('id', messageId);

      return NextResponse.json(
        { error: 'Failed to send email', details: sendError },
        { status: 500 }
      );
    }

    // Update message record with sent status and timestamp
    const { error: updateError } = await supabase
      .from('messages')
      .update({
        status: 'sent',
        sent_at: new Date().toISOString(),
      })
      .eq('id', messageId);

    if (updateError) {
      console.error('Error updating message record:', updateError);
      // Email was sent successfully, so we'll still return success
      // but log the error
    }

    return NextResponse.json({
      success: true,
      messageId,
      emailId: emailData?.id,
    });

  } catch (error) {
    console.error('Unexpected error in send-email:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
