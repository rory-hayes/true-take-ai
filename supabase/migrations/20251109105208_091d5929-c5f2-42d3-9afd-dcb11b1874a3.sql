-- Remove referral system tables and columns

-- Drop referrals table
DROP TABLE IF EXISTS public.referrals CASCADE;

-- Remove referral-related columns from profiles
ALTER TABLE public.profiles 
  DROP COLUMN IF EXISTS invites_sent,
  DROP COLUMN IF EXISTS max_invites,
  DROP COLUMN IF EXISTS invites_sent_today,
  DROP COLUMN IF EXISTS last_invite_date;