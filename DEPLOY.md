# Deployment Guide

## ✅ Completed Tasks

1. ✅ Added toast notifications (react-hot-toast)
2. ✅ Enhanced error handling across all pages
3. ✅ Added loading states to all pages
4. ✅ Created favicon and OG image (SVG)
5. ✅ Added comprehensive meta tags
6. ✅ Fixed metadataBase for proper OG image resolution
7. ✅ Fixed dynamic route warning for track-open
8. ✅ Created comprehensive README.md
9. ✅ Build verified and passing
10. ✅ GitHub repository created: https://github.com/ahoque32/followback
11. ✅ Code pushed to GitHub main branch

## 🚀 Next Step: Deploy to Vercel

You need to deploy the app to Vercel. Here are your options:

### Option 1: Via Vercel Dashboard (Recommended for First Deploy)

1. Go to https://vercel.com/login
2. Sign in with your GitHub account (ahoque32)
3. Click "Add New..." → "Project"
4. Import the `followback` repository
5. Configure environment variables (copy from `.env.local`):
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
   - `CLERK_SECRET_KEY`
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `RESEND_API_KEY`
   - `TWILIO_ACCOUNT_SID` (if using SMS)
   - `TWILIO_AUTH_TOKEN` (if using SMS)
   - `TWILIO_PHONE_NUMBER` (if using SMS)
   - `STRIPE_SECRET_KEY` (if using payments)
   - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (if using payments)
   - `STRIPE_WEBHOOK_SECRET` (if using payments)
   - `CRON_SECRET`
6. Click "Deploy"
7. Wait for deployment to complete
8. Your app will be live at: `https://followback.vercel.app` (or similar)

### Option 2: Via Vercel CLI

```bash
# Login to Vercel
vercel login

# Deploy to production
cd /home/ahawk/followback
vercel --prod

# Follow the prompts to:
# - Set up and deploy
# - Link to existing project or create new
# - Configure environment variables
```

### Option 3: Quick CLI Deploy Script

```bash
#!/bin/bash
cd /home/ahawk/followback

# Login to Vercel (opens browser)
vercel login

# Deploy to production
vercel --prod --yes
```

## 📋 Post-Deployment Checklist

After deployment, verify:

- [ ] App loads at production URL
- [ ] Authentication works (sign up, sign in, sign out)
- [ ] Can add customers
- [ ] Can create campaigns
- [ ] Can view analytics dashboard
- [ ] Toast notifications appear on actions
- [ ] Favicon and meta tags display correctly
- [ ] Check browser console for errors

## 🔧 Environment Variables Required

Make sure ALL of these are set in Vercel:

```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
CLERK_SECRET_KEY
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
RESEND_API_KEY
CRON_SECRET
```

Optional (for full features):
```
TWILIO_ACCOUNT_SID
TWILIO_AUTH_TOKEN
TWILIO_PHONE_NUMBER
STRIPE_SECRET_KEY
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
STRIPE_WEBHOOK_SECRET
```

## 🔄 Set Up Cron Job

After deployment, configure the cron job in `vercel.json` or set up an external cron:

### Vercel Cron (Built-in)

The `vercel.json` file already includes cron configuration:

```json
{
  "crons": [
    {
      "path": "/api/cron/check-campaigns",
      "schedule": "0 * * * *"
    }
  ]
}
```

This will run hourly automatically.

### External Cron (Alternative)

If you prefer external cron, use https://cron-job.org:

1. Create account at cron-job.org
2. Add new cron job:
   - URL: `https://your-app.vercel.app/api/cron/check-campaigns`
   - Schedule: Every hour (0 * * * *)
   - HTTP Header: `Authorization: Bearer YOUR_CRON_SECRET`

## 🎉 You're Done!

Once deployed, your app will be live at:
- Production URL: `https://followback.vercel.app` (or your custom domain)
- GitHub Repo: https://github.com/ahoque32/followback

Share the URL and start winning back customers! 🚀
