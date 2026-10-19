DROP POLICY "Public reads active brands" ON public.brands;
CREATE POLICY "Public reads active brands" ON public.brands FOR SELECT TO anon, authenticated USING (is_active);