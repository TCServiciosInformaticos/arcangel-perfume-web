REVOKE SELECT (store_whatsapp, store_email) ON public.settings FROM anon, authenticated;
GRANT SELECT (store_whatsapp, store_email) ON public.settings TO service_role;