ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS view_costs boolean DEFAULT false;
