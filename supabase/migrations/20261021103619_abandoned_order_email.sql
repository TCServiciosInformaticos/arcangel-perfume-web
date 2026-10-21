ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'recovery_pending';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'recovery_notified';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'abandoned_final';
