-- Add date_of_birth to profiles table
ALTER TABLE public.profiles
ADD COLUMN date_of_birth date;

-- Add a comment explaining the column
COMMENT ON COLUMN public.profiles.date_of_birth IS 'User date of birth for pension calculation purposes';