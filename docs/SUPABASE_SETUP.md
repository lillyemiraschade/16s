# Supabase Setup Guide

Follow these steps to configure Supabase for 16s auth and cloud storage.

## 1. Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign in
2. Click **New Project**
3. Enter project name: `16s` (or whatever you prefer)
4. Set a strong database password (save this!)
5. Choose your region (closest to your users)
6. Click **Create new project**

Wait for the project to be provisioned (~2 minutes).

## 2. Get API Keys

1. Go to **Project Settings** > **API**
2. Copy these values to your `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## 3. Run Database Schema

1. Go to **SQL Editor** in your Supabase dashboard
2. Click **New Query**
3. Copy the entire contents of `supabase/schema.sql`
4. Click **Run** (or Cmd/Ctrl + Enter)
5. You should see "Success. No rows returned."

## 4. Enable Authentication Providers

### Email/Password (enabled by default)
No additional setup needed.

### Google OAuth
1. Go to **Authentication** > **Providers**
2. Find **Google** and toggle it on
3. Go to [Google Cloud Console](https://console.cloud.google.com/)
4. Create or select a project
5. Go to **APIs & Services** > **Credentials**
6. Click **Create Credentials** > **OAuth client ID**
7. Select **Web application**
8. Add authorized redirect URI: `https://your-project-ref.supabase.co/auth/v1/callback`
9. Copy the Client ID and Client Secret back to Supabase

### GitHub OAuth
1. Go to **Authentication** > **Providers**
2. Find **GitHub** and toggle it on
3. Go to [GitHub Developer Settings](https://github.com/settings/developers)
4. Click **New OAuth App**
5. Set Homepage URL: `http://localhost:3000` (or your production URL)
6. Set Callback URL: `https://your-project-ref.supabase.co/auth/v1/callback`
7. Copy the Client ID and Client Secret back to Supabase

## 5. Configure Auth Settings

1. Go to **Authentication** > **URL Configuration**
2. Set **Site URL**: `http://localhost:3000` (or your production domain)
3. Add **Redirect URLs**:
   - `http://localhost:3000/auth/callback`
   - `https://your-production-domain.com/auth/callback` (when ready)

## 6. Test It

1. Restart your dev server: `npm run dev`
2. Open `http://localhost:3000`
3. Click **Sign in** in the header
4. Try signing up with email or OAuth
5. Create a project and check it saves to Supabase

## Troubleshooting

### "Missing Supabase URL or Key" error
- Make sure `.env.local` has both `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Restart the dev server after changing env vars

### OAuth redirect errors
- Check that your callback URLs match exactly in both Supabase and the OAuth provider
- Make sure you're using `https://` for the Supabase callback

### RLS errors (permission denied)
- Make sure you ran the entire `schema.sql` file
- Check that RLS policies were created correctly in **Authentication** > **Policies**

### Projects not loading
- Open browser DevTools > Console for error messages
- Check **Supabase Dashboard** > **Table Editor** > **projects** to see if data is there

## Database Schema

The schema creates these tables:
- `projects` - User projects with messages, preview HTML, bookmarks
- `deployments` - Deployed sites (for future use)
- `subscriptions` - Billing plans (for future use)
- `usage` - API usage tracking (for future use)

All tables have Row Level Security enabled so users can only access their own data.
