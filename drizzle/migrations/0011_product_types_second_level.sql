CREATE TABLE public.product_types (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), subcategory_id uuid NOT NULL REFERENCES public.subcategories(id) ON DELETE RESTRICT, name text NOT NULL, slug text NOT NULL, sort_order integer NOT NULL DEFAULT 0, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(subcategory_id, slug), UNIQUE(subcategory_id, id));
GRANT SELECT ON public.product_types TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_types TO authenticated;
GRANT ALL ON public.product_types TO service_role;
ALTER TABLE public.product_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read product types" ON public.product_types FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins manage product types" ON public.product_types FOR ALL TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));
ALTER TABLE public.products ADD COLUMN product_type_id uuid;
ALTER TABLE public.products ADD CONSTRAINT products_product_type_subcategory_fkey FOREIGN KEY (subcategory_id, product_type_id) REFERENCES public.product_types(subcategory_id, id) ON DELETE RESTRICT;
ALTER TABLE public.products ADD CONSTRAINT products_product_type_requires_subcategory CHECK (product_type_id IS NULL OR subcategory_id IS NOT NULL);
CREATE INDEX products_product_type_idx ON public.products(product_type_id);
INSERT INTO public.product_types (subcategory_id, name, slug, sort_order)
SELECT han.id, s.name, regexp_replace(s.slug, '^han-', ''), s.sort_order
FROM public.subcategories s JOIN public.subcategories han ON han.name = 'Han' AND han.category_id = s.category_id
WHERE s.slug LIKE 'han-%';
UPDATE public.products p SET subcategory_id = han.id, product_type_id = t.id
FROM public.subcategories s
JOIN public.subcategories han ON han.name = 'Han' AND han.category_id = s.category_id
JOIN public.product_types t ON t.subcategory_id = han.id AND t.slug = regexp_replace(s.slug, '^han-', '')
WHERE p.subcategory_id = s.id AND s.slug LIKE 'han-%';
DELETE FROM public.subcategories s WHERE s.slug LIKE 'han-%' AND NOT EXISTS (SELECT 1 FROM public.products p WHERE p.subcategory_id = s.id);