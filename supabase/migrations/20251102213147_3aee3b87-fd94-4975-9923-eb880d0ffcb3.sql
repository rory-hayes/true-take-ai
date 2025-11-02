-- Add explicit RLS policies for subscriptions table to prevent unauthorized modifications
-- Only backend edge functions (using service role) should be able to INSERT, UPDATE, or DELETE

-- Prevent users from inserting subscription records directly
CREATE POLICY "Subscriptions can only be created by backend"
ON public.subscriptions
FOR INSERT
TO authenticated
WITH CHECK (false);

-- Prevent users from updating subscription records directly
CREATE POLICY "Subscriptions can only be updated by backend"
ON public.subscriptions
FOR UPDATE
TO authenticated
USING (false);

-- Prevent users from deleting subscription records directly
CREATE POLICY "Subscriptions can only be deleted by backend"
ON public.subscriptions
FOR DELETE
TO authenticated
USING (false);