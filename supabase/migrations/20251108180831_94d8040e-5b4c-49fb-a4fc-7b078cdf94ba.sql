-- Drop the old constraint
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_subscription_tier_check;

-- Add new constraint that allows 'free', 'monthly', and 'annual'
ALTER TABLE profiles ADD CONSTRAINT profiles_subscription_tier_check 
CHECK (subscription_tier IN ('free', 'monthly', 'annual'));