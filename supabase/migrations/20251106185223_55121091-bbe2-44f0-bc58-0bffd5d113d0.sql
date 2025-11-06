-- Add daily invite tracking to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS invites_sent_today integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_invite_date date;

-- Update referrals table to add sent_at timestamp if not exists
-- (created_at already serves this purpose, but let's ensure we track it properly)

-- Add a comment to document the status values
COMMENT ON COLUMN public.referrals.status IS 'Status values: pending (invite sent), completed (user signed up), rewarded (both parties received rewards), expired (invite link expired)';

-- Create index for faster daily limit checks
CREATE INDEX IF NOT EXISTS idx_profiles_invite_tracking ON public.profiles(id, last_invite_date, invites_sent_today);