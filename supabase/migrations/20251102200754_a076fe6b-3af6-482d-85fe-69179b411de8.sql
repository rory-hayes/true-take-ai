-- Add lifetime invite tracking to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS invites_sent integer NOT NULL DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS max_invites integer NOT NULL DEFAULT 3;

-- Drop the daily rate limit table as it's no longer needed
DROP TABLE IF EXISTS public.invite_rate_limits;