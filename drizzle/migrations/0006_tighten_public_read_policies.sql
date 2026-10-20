REVOKE SELECT ON public.settings FROM anon, authenticated;
GRANT SELECT (id, store_name, shipping_cost, shipping_zones, pickup_address, store_hours, hero_subtitle, updated_at) ON public.settings TO anon, authenticated;
DROP POLICY IF EXISTS "Public read settings" ON public.settings;
CREATE POLICY "Public read store settings row" ON public.settings FOR SELECT TO anon, authenticated USING (id = 1);

DROP POLICY IF EXISTS "Authenticated read all products" ON public.products;
CREATE POLICY "Authenticated read active products" ON public.products FOR SELECT TO authenticated USING (is_active = true OR private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Public read product images" ON storage.objects;
CREATE POLICY "Admins read product images" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'product-images' AND private.has_role(auth.uid(), 'admin'::public.app_role));