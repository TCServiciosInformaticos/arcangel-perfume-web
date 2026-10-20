INSERT INTO public.subcategories (category_id, name, slug, sort_order)
SELECT s.category_id, v.name, v.slug, v.sort_order
FROM public.subcategories s
JOIN (VALUES
  ('Shampoo', 'han-shampoo', 1),
  ('Enjuagues', 'han-enjuagues', 2),
  ('Baños de crema', 'han-banos-de-crema', 3),
  ('Finalizadores', 'han-finalizadores', 4),
  ('Coloración', 'han-coloracion', 5),
  ('Profesionales', 'han-profesionales', 6),
  ('Aptos', 'han-aptos', 7)
) AS v(name, slug, sort_order) ON true
WHERE s.name = 'Han'
ON CONFLICT DO NOTHING;