# Campaign Automation Cron Job

This document describes the automated campaign processing system.

## Overview

The `/api/cron/check-campaigns` endpoint runs daily at 9:00 AM UTC to automatically send messages to customers based on active campaign rules.

## How It Works

1. **Queries active campaigns** from the database
2. **Finds eligible customers** for each campaign:
   - Last visit is older than the campaign's `trigger_days`
   - Not opted out (`opt_out = false`)
   - Haven't been messaged by this campaign before
3. **Rate limiting**: Maximum 100 messages per campaign per run
4. **Sends messages** via email and/or SMS based on campaign channel setting
5. **Logs results** to the messages table with status tracking

## Setup

### Environment Variables

Add these to your `.env.local` and Vercel environment variables:

```bash
# Required for cron job
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key_here
CRON_SECRET=generate_a_secure_random_string
NEXT_PUBLIC_APP_URL=https://yourdomain.com

# Also ensure these are set (for sending)
RESEND_API_KEY=your_resend_api_key
RESEND_FROM_EMAIL=noreply@yourdomain.com
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE_NUMBER=your_twilio_phone_number
```

### Vercel Configuration

The `vercel.json` file configures the cron schedule:

```json
{
  "crons": [
    {
      "path": "/api/cron/check-campaigns",
      "schedule": "0 9 * * *"
    }
  ]
}
```

Schedule format: `minute hour day month dayOfWeek` (standard cron syntax)
- `0 9 * * *` = Every day at 9:00 AM UTC

### Security

The endpoint is protected by the `CRON_SECRET` environment variable. Vercel automatically adds the correct authorization header when invoking cron jobs.

## Testing Locally

1. Start the development server:
```bash
npm run dev
```

2. Make a test request:
```bash
curl -X POST http://localhost:3000/api/cron/check-campaigns \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

Replace `YOUR_CRON_SECRET` with the value from your `.env.local` file.

## Response Format

Successful response:

```json
{
  "success": true,
  "summary": {
    "totalCampaigns": 3,
    "totalCustomersProcessed": 45,
    "totalEmailsSent": 32,
    "totalSmsSent": 13,
    "totalErrors": 0
  },
  "results": [
    {
      "campaignId": "uuid-123",
      "campaignName": "30-day win-back",
      "customersProcessed": 15,
      "emailsSent": 12,
      "smsSent": 3,
      "errors": []
    }
  ]
}
```

## Template Variables

Campaign templates support these variables:
- `{name}` - Customer name
- `{business}` - Business name
- `{discount}` - Discount percentage
- `{link}` - Tracking link for analytics

## Database Schema

### campaigns
- `id`: UUID
- `business_id`: UUID
- `name`: Text
- `trigger_days`: Integer (e.g., 14, 30, 60)
- `channel`: Text ('email', 'sms', or 'both')
- `template`: Text (message with variables)
- `discount_percent`: Integer
- `active`: Boolean

### customers
- `id`: UUID
- `business_id`: UUID
- `name`: Text
- `email`: Text (nullable)
- `phone`: Text (nullable)
- `last_visit`: Timestamp
- `opt_out`: Boolean

### messages
- `id`: UUID
- `campaign_id`: UUID
- `customer_id`: UUID
- `channel`: Text ('email' or 'sms')
- `status`: Text ('pending', 'sent', 'failed')
- `sent_at`: Timestamp (nullable)
- `opened_at`: Timestamp (nullable)

## Monitoring

Check Vercel's Cron Logs dashboard to monitor:
- Execution times
- Success/failure rates
- Response payloads
- Error messages

## Troubleshooting

**No messages sent:**
- Check that campaigns are marked as `active = true`
- Verify customers have valid email/phone numbers
- Ensure `last_visit` dates are older than `trigger_days`
- Check if customers were already messaged

**Authentication errors:**
- Verify `CRON_SECRET` matches in Vercel environment
- Ensure `SUPABASE_SERVICE_ROLE_KEY` is set correctly

**Send failures:**
- Check Resend/Twilio API keys and credentials
- Review error details in the response payload
- Check individual message status in the `messages` table
