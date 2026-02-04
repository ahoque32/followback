import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Use admin client for webhook since it's coming from Twilio, not a user session
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(request: NextRequest) {
  try {
    // Parse form data (Twilio sends webhooks as application/x-www-form-urlencoded)
    const formData = await request.formData();
    
    // Extract relevant Twilio webhook parameters
    const messageSid = formData.get('MessageSid') as string;
    const messageStatus = formData.get('MessageStatus') as string;
    const body = formData.get('Body') as string;
    const from = formData.get('From') as string;
    const to = formData.get('To') as string;
    
    // Log the webhook for debugging
    console.log('Twilio webhook received:', {
      messageSid,
      messageStatus,
      body,
      from,
      to,
    });

    // Create Supabase admin client (bypasses RLS for webhook processing)
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Handle incoming message (user reply)
    if (body && from) {
      const messageBody = body.trim().toUpperCase();
      
      // Handle STOP/UNSUBSCRIBE replies
      if (messageBody === 'STOP' || messageBody === 'UNSUBSCRIBE' || messageBody === 'END' || messageBody === 'QUIT') {
        console.log(`Opt-out request received from ${from}`);
        
        // Find customer by phone number and mark as opted out
        const { data: customers, error: customerError } = await supabase
          .from('customers')
          .select('id')
          .eq('phone', from);

        if (customerError) {
          console.error('Error finding customer for opt-out:', customerError);
        } else if (customers && customers.length > 0) {
          // Update all matching customers (in case of duplicates)
          for (const customer of customers) {
            const { error: updateError } = await supabase
              .from('customers')
              .update({ opt_out: true })
              .eq('id', customer.id);

            if (updateError) {
              console.error('Error updating customer opt-out status:', updateError);
            } else {
              console.log(`Customer ${customer.id} marked as opted out`);
            }
          }
        } else {
          console.log(`No customer found with phone ${from}`);
        }

        // Twilio expects an empty 200 response or TwiML
        return new NextResponse('', { status: 200 });
      }
    }

    // Handle delivery status updates
    if (messageSid && messageStatus) {
      // Find the message by Twilio SID and update its delivery status
      const { error: updateError } = await supabase
        .from('messages')
        .update({ 
          delivery_status: messageStatus,
          // Update status to 'delivered' if Twilio status is 'delivered'
          // Keep 'sent' for other statuses unless it's failed/undelivered
          status: messageStatus === 'delivered' ? 'delivered' : 
                  (messageStatus === 'failed' || messageStatus === 'undelivered') ? 'failed' : 'sent'
        })
        .eq('twilio_message_sid', messageSid);

      if (updateError) {
        console.error('Error updating message delivery status:', updateError);
        // Still return 200 to prevent Twilio from retrying
      } else {
        console.log(`Message ${messageSid} status updated to ${messageStatus}`);
      }
    }

    // Twilio expects a 200 response to acknowledge receipt
    return new NextResponse('', { status: 200 });

  } catch (error) {
    console.error('Error processing Twilio webhook:', error);
    // Return 200 even on error to prevent Twilio from retrying
    // (we've already logged the error for investigation)
    return new NextResponse('', { status: 200 });
  }
}
