ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'abandoned';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'payment_rejected';
