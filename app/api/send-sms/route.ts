import { NextRequest, NextResponse } from 'next/server';
import twilio from 'twilio';
import { createSupabaseServerClient } from '@/lib/supabase-server';

interface SendSmsRequest {
  customerId: string;
  campaignId: string;
  message: string;
  phoneNumber: string;
}

export async function POST(request: NextRequest) {
  try {
    // Initialize Twilio client
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = process.env.TWILIO_PHONE_NUMBER;

    if (!accountSid || !authToken || !fromNumber) {
      return NextResponse.json(
        { error: 'Twilio configuration missing' },
        { status: 500 }
      );
    }

    const twilioClient = twilio(accountSid, authToken);
    
    // Parse request body
    const body: SendSmsRequest = await request.json();
    
    // Validate required fields
    if (!body.customerId || !body.campaignId || !body.message || !body.phoneNumber) {
      return NextResponse.json(
        { error: 'Missing required fields: customerId, campaignId, message, or phoneNumber' },
        { status: 400 }
      );
    }

    // Validate phone number format (basic E.164 check)
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    if (!phoneRegex.test(body.phoneNumber.replace(/\s+/g, ''))) {
      return NextResponse.json(
        { error: 'Invalid phone number format. Use E.164 format (e.g., +1234567890)' },
        { status: 400 }
      );
    }

    // Validate message length (SMS limit is 160 chars for GSM, 70 for Unicode)
    // We'll use 1600 as a reasonable limit for concatenated messages
    if (body.message.length > 1600) {
      return NextResponse.json(
        { error: 'Message too long. Maximum 1600 characters.' },
        { status: 400 }
      );
    }

    // Create Supabase client
    const supabase = await createSupabaseServerClient();

    // Check if customer has opted out
    const { data: customerData, error: customerError } = await supabase
      .from('customers')
      .select('opt_out')
      .eq('id', body.customerId)
      .single();

    if (customerError) {
      console.error('Error fetching customer:', customerError);
      return NextResponse.json(
        { error: 'Failed to verify customer' },
        { status: 500 }
      );
    }

    if (customerData?.opt_out) {
      return NextResponse.json(
        { error: 'Customer has opted out of SMS messages' },
        { status: 400 }
      );
    }

    // Add opt-out instructions to message
    const fullMessage = `${body.message}\n\nReply STOP to unsubscribe`;

    // Insert message record first to get the message ID
    const { data: messageData, error: insertError } = await supabase
      .from('messages')
      .insert({
        customer_id: body.customerId,
        campaign_id: body.campaignId,
        channel: 'sms',
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

    // Get webhook URL for status callbacks
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const statusCallback = `${baseUrl}/api/twilio/webhook`;

    try {
      // Send SMS via Twilio
      const twilioMessage = await twilioClient.messages.create({
        body: fullMessage,
        from: fromNumber,
        to: body.phoneNumber,
        statusCallback: statusCallback,
      });

      // Update message record with sent status and Twilio SID
      const { error: updateError } = await supabase
        .from('messages')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString(),
          twilio_message_sid: twilioMessage.sid,
          delivery_status: twilioMessage.status,
        })
        .eq('id', messageId);

      if (updateError) {
        console.error('Error updating message record:', updateError);
        // SMS was sent successfully, so we'll still return success
        // but log the error
      }

      return NextResponse.json({
        success: true,
        messageId,
        twilioSid: twilioMessage.sid,
        status: twilioMessage.status,
      });

    } catch (twilioError) {
      console.error('Error sending SMS via Twilio:', twilioError);
      
      // Update message status to failed
      await supabase
        .from('messages')
        .update({ 
          status: 'failed',
          delivery_status: 'failed'
        })
        .eq('id', messageId);

      const errorMessage = twilioError instanceof Error ? twilioError.message : 'Unknown Twilio error';

      return NextResponse.json(
        { 
          error: 'Failed to send SMS', 
          details: errorMessage
        },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Unexpected error in send-sms:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
