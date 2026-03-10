ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{ "notifications": "ring", "theme": "dark-blue" }'::jsonb;
