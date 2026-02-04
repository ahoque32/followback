# SMS API Testing Guide

## Setup

1. Ensure environment variables are set in `.env.local`:
   ```
   TWILIO_ACCOUNT_SID=your_actual_sid
   TWILIO_AUTH_TOKEN=your_actual_token
   TWILIO_PHONE_NUMBER=+1234567890
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   ```

2. Make sure you have a Twilio account with:
   - Active phone number
   - Webhook configured to: `https://your-domain.com/api/twilio/webhook`

## Test Send SMS

```bash
curl -X POST http://localhost:3000/api/send-sms \
  -H "Content-Type: application/json" \
  -d '{
    "customerId": "UUID_HERE",
    "campaignId": "UUID_HERE",
    "message": "Hello! This is a test message from our campaign.",
    "phoneNumber": "+1234567890"
  }'
```

Expected response (success):
```json
{
  "success": true,
  "messageId": "uuid",
  "twilioSid": "SM...",
  "status": "queued"
}
```

## Test Webhook (Delivery Status)

Twilio will automatically POST to `/api/twilio/webhook` when message status changes.

You can simulate this locally:

```bash
curl -X POST http://localhost:3000/api/twilio/webhook \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "MessageSid=SM123456789&MessageStatus=delivered"
```

## Test Opt-Out

Send "STOP" reply from a customer's phone to the Twilio number.
The webhook will receive:

```bash
curl -X POST http://localhost:3000/api/twilio/webhook \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "MessageSid=SM123456789&Body=STOP&From=+1234567890&To=+19876543210"
```

This should:
1. Mark the customer as opted out in the database
2. Return 200 OK to Twilio
3. Customer will not receive future SMS messages

## Verification

After sending an SMS, check the database:

```sql
-- Check message was created
SELECT * FROM messages WHERE channel = 'sms' ORDER BY created_at DESC LIMIT 1;

-- Check delivery status updates
SELECT twilio_message_sid, status, delivery_status FROM messages WHERE twilio_message_sid = 'SM...';

-- Check opt-out status
SELECT id, name, phone, opt_out FROM customers WHERE phone = '+1234567890';
```

## Notes

- Messages automatically include "Reply STOP to unsubscribe"
- Maximum message length: 1600 characters
- Phone numbers must be in E.164 format (+1234567890)
- Customers who opted out will not receive messages (API returns 400)
- Webhook returns 200 even on errors to prevent Twilio retries
