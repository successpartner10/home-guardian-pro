-- Admin Approval Migration
-- Run this in your Supabase SQL Editor

-- 1. Add is_approved to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS is_approved BOOLEAN DEFAULT FALSE;

-- 2. Ensure successpartner10@gmail.com is approved and an admin
-- Note: Replace with the actual user_id from auth.users if needed
UPDATE public.profiles
SET is_approved = TRUE
WHERE user_id IN (
  SELECT id FROM auth.users WHERE email = 'successpartner10@gmail.com'
);

-- 3. Add RLS policies (optional but recommended)
-- Only admins can see all profiles
-- Users can see their own profile
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" 
ON public.profiles FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all profiles" 
ON public.profiles FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM auth.users 
    WHERE id = auth.uid() AND email = 'successpartner10@gmail.com'
  )
);

CREATE POLICY "Admins can update all profiles" 
ON public.profiles FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM auth.users 
    WHERE id = auth.uid() AND email = 'successpartner10@gmail.com'
  )
);
