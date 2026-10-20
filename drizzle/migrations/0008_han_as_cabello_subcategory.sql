DO $$
DECLARE han_cat uuid; cab uuid; han_sub uuid;
BEGIN
  SELECT id INTO han_cat FROM public.categories WHERE slug = 'han';
  SELECT id INTO cab FROM public.categories WHERE slug = 'cabello';
  IF han_cat IS NULL OR cab IS NULL THEN RETURN; END IF;
  INSERT INTO public.subcategories (category_id, name, slug, sort_order)
  VALUES (cab, 'Han', 'han', 10) RETURNING id INTO han_sub;
  UPDATE public.products SET category_id = cab, subcategory_id = han_sub WHERE category_id = han_cat;
  DELETE FROM public.subcategories WHERE category_id = han_cat;
  DELETE FROM public.categories WHERE id = han_cat;
END $$;