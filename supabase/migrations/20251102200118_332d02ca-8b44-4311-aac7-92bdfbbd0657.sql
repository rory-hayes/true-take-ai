-- Add IP address tracking to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS signup_ip_address text;

-- Create table for invite rate limiting
CREATE TABLE IF NOT EXISTS public.invite_rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invite_date date NOT NULL DEFAULT CURRENT_DATE,
  invite_count integer NOT NULL DEFAULT 1,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(user_id, invite_date)
);

-- Enable RLS on invite_rate_limits
ALTER TABLE public.invite_rate_limits ENABLE ROW LEVEL SECURITY;

-- Policy for users to view their own rate limits
CREATE POLICY "Users can view their own rate limits"
ON public.invite_rate_limits
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Policy for users to insert their own rate limits
CREATE POLICY "Users can insert their own rate limits"
ON public.invite_rate_limits
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Policy for users to update their own rate limits
CREATE POLICY "Users can update their own rate limits"
ON public.invite_rate_limits
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);