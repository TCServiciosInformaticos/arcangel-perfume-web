BEGIN;
CREATE INDEX IF NOT EXISTS products_public_recent ON public.products(created_at DESC,id ASC) WHERE is_active;
CREATE INDEX IF NOT EXISTS products_public_price ON public.products(price,id) WHERE is_active;
CREATE FUNCTION public.store_catalog_page(p_category text DEFAULT NULL,p_brand text DEFAULT NULL,p_type text DEFAULT NULL,p_query text DEFAULT '',p_offers boolean DEFAULT false,p_sort text DEFAULT 'recent',p_page int DEFAULT 1) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE category_filter uuid; type_filter uuid; result jsonb; BEGIN
 IF length(coalesce(p_query,''))>200 OR length(coalesce(p_category,''))>200 OR length(coalesce(p_brand,''))>100 OR length(coalesce(p_type,''))>100 OR coalesce(p_page,1)>100000 THEN RAISE EXCEPTION 'Filtro de catálogo inválido';END IF;
 SELECT id INTO category_filter FROM public.categories WHERE id::text=p_category OR slug=p_category LIMIT 1;
 SELECT id INTO type_filter FROM public.product_types WHERE id::text=p_type AND subcategory_id::text=p_brand LIMIT 1;
 WITH filtered AS MATERIALIZED (
 SELECT p.id,p.created_at,p.price FROM public.products p WHERE p.is_active
 AND (category_filter IS NULL OR p.category_id=category_filter)
 AND (nullif(p_brand,'') IS NULL OR p.subcategory_id::text=p_brand)
 AND (type_filter IS NULL OR p.product_type_id=type_filter)
 AND (NOT coalesce(p_offers,false) OR p.compare_at_price>p.price)
 AND (btrim(coalesce(p_query,''))='' OR strpos(lower(p.name),lower(btrim(p_query)))>0)
 ), counts AS(SELECT count(*) total FROM filtered),pagination AS(
 SELECT total,least(greatest(coalesce(p_page,1),1),greatest(1,ceil(total/24.0)::int)) page FROM counts
 ), ids AS (
 SELECT f.id,row_number() OVER(ORDER BY CASE WHEN p_sort='price-asc' THEN price END ASC,CASE WHEN p_sort='price-desc' THEN price END DESC,CASE WHEN p_sort NOT IN ('price-asc','price-desc') OR p_sort IS NULL THEN created_at END DESC,id ASC) position
 FROM filtered f ORDER BY position LIMIT 24 OFFSET (SELECT (page-1)*24 FROM pagination)
 ), rows AS (
 SELECT p.id,p.slug,p.name,p.price,p.compare_at_price,p.stock,p.image_urls,p.thumbnail_url,p.category_id,p.subcategory_id,p.product_type_id,jsonb_build_object('name',c.name) category,i.position
 FROM ids i JOIN public.products p ON p.id=i.id LEFT JOIN public.categories c ON c.id=p.category_id
 ) SELECT jsonb_build_object('total',(SELECT total FROM pagination),'page',(SELECT page FROM pagination),'products',coalesce((SELECT jsonb_agg(to_jsonb(r)-'position' ORDER BY position) FROM rows r),'[]'::jsonb)) INTO result;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.store_catalog_page(text,text,text,text,boolean,text,int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.store_catalog_page(text,text,text,text,boolean,text,int) TO anon,authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
