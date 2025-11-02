-- Create profiles table
CREATE TABLE public.profiles (
  id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  payment_day INTEGER,
  subscription_tier TEXT NOT NULL DEFAULT 'free' CHECK (subscription_tier IN ('free', 'monthly', 'yearly')),
  uploads_remaining INTEGER NOT NULL DEFAULT 3,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Create payslips table
CREATE TABLE public.payslips (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  upload_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  pay_period_start DATE,
  pay_period_end DATE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'confirmed', 'error')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.payslips ENABLE ROW LEVEL SECURITY;

-- Payslips policies
CREATE POLICY "Users can view their own payslips"
  ON public.payslips FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own payslips"
  ON public.payslips FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own payslips"
  ON public.payslips FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own payslips"
  ON public.payslips FOR DELETE
  USING (auth.uid() = user_id);

-- Create payslip data table for extracted KVPs
CREATE TABLE public.payslip_data (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  payslip_id UUID NOT NULL REFERENCES public.payslips(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  gross_pay DECIMAL(10, 2),
  net_pay DECIMAL(10, 2),
  tax_deducted DECIMAL(10, 2),
  social_security DECIMAL(10, 2),
  pension DECIMAL(10, 2),
  other_deductions DECIMAL(10, 2),
  additional_data JSONB,
  confirmed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(payslip_id)
);

-- Enable RLS
ALTER TABLE public.payslip_data ENABLE ROW LEVEL SECURITY;

-- Payslip data policies
CREATE POLICY "Users can view their own payslip data"
  ON public.payslip_data FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own payslip data"
  ON public.payslip_data FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own payslip data"
  ON public.payslip_data FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own payslip data"
  ON public.payslip_data FOR DELETE
  USING (auth.uid() = user_id);

-- Create function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, subscription_tier, uploads_remaining)
  VALUES (
    new.id,
    new.email,
    'free',
    3
  );
  RETURN new;
END;
$$;

-- Create trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Create triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_payslips_updated_at
  BEFORE UPDATE ON public.payslips
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_payslip_data_updated_at
  BEFORE UPDATE ON public.payslip_data
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for payslips
INSERT INTO storage.buckets (id, name, public)
VALUES ('payslips', 'payslips', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for payslips bucket
CREATE POLICY "Users can view their own payslip files"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'payslips' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can upload their own payslip files"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'payslips' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete their own payslip files"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'payslips' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );