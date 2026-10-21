-- Aggregate in PostgreSQL: no customer data or 1,000-row API truncation.
CREATE INDEX IF NOT EXISTS order_events_approved_date ON public.order_events(order_id,created_at) WHERE kind='payment_approved';
CREATE OR REPLACE FUNCTION public.admin_sales_statistics(
 p_from date, p_to date, p_category uuid DEFAULT NULL, p_brand uuid DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE result jsonb; start_at timestamptz; end_at timestamptz; previous_at timestamptz;
BEGIN
 IF NOT coalesce(private.has_role(auth.uid(),'admin'),false) THEN
  RAISE EXCEPTION 'Solo administradores.' USING ERRCODE='42501';
 END IF;
 IF p_from IS NULL OR p_to IS NULL OR p_to<p_from OR p_to-p_from>365 THEN
  RAISE EXCEPTION 'Elegí un período de entre 1 y 366 días.' USING ERRCODE='22023';
 END IF;
 start_at := p_from::timestamp AT TIME ZONE 'America/Argentina/Buenos_Aires';
 end_at := (p_to+1)::timestamp AT TIME ZONE 'America/Argentina/Buenos_Aires';
 previous_at := (p_from-(p_to-p_from+1))::timestamp AT TIME ZONE 'America/Argentina/Buenos_Aires';
 WITH product_scope AS MATERIALIZED (
  SELECT p.*,coalesce(c.name,'Sin categoría') category,coalesce(b.name,'Sin marca') brand
  FROM public.products p LEFT JOIN public.categories c ON c.id=p.category_id
  LEFT JOIN public.subcategories b ON b.id=p.subcategory_id
  WHERE (p_category IS NULL OR p.category_id=p_category) AND (p_brand IS NULL OR p.subcategory_id=p_brand)
 ), verified AS MATERIALIZED (
  SELECT o.id,o.total,o.shipping_cost,coalesce(e.paid_at,a.created_at) paid_at,e.paid_at IS NULL estimated_date
  FROM public.orders o
  JOIN LATERAL (SELECT a.created_at FROM public.order_payment_attempts a
   WHERE a.order_id=o.id AND a.state='approved' AND a.payment_id=o.mp_payment_id
   ORDER BY a.created_at,a.id LIMIT 1) a ON true
  LEFT JOIN LATERAL (SELECT min(e.created_at) paid_at FROM public.order_events e
   WHERE e.order_id=o.id AND e.kind='payment_approved' AND e.detail->>'payment_id'=o.mp_payment_id) e ON true
  WHERE o.status IN ('paid','preparing','shipped','delivered') AND o.mp_payment_id IS NOT NULL
 ), lines AS MATERIALIZED (
  SELECT v.*,i.product_id,i.product_name,i.quantity,i.line_total,
   coalesce(p.category,'Sin categoría') category,coalesce(p.brand,'Sin marca') brand
  FROM verified v JOIN public.order_items i ON i.order_id=v.id
  LEFT JOIN product_scope p ON p.id=i.product_id
  WHERE v.paid_at>=previous_at AND v.paid_at<end_at
   AND ((p_category IS NULL AND p_brand IS NULL) OR p.id IS NOT NULL)
 ), order_totals AS MATERIALIZED (
  SELECT id,paid_at,bool_or(estimated_date) estimated_date,sum(quantity) units,
   CASE WHEN p_category IS NULL AND p_brand IS NULL THEN max(total) ELSE sum(line_total) END revenue,
   CASE WHEN p_category IS NULL AND p_brand IS NULL THEN max(shipping_cost) ELSE 0 END shipping
  FROM lines GROUP BY id,paid_at
 ), product_sales AS (
  SELECT product_id,sum(quantity) units,sum(line_total) revenue
  FROM lines WHERE paid_at>=start_at GROUP BY product_id
 ), product_rows AS (
  SELECT p.id,p.name,p.article_code,p.category,p.brand,p.stock,p.is_active,p.created_at,
   coalesce(s.units,0) units,coalesce(s.revenue,0) revenue
  FROM product_scope p LEFT JOIN product_sales s ON s.product_id=p.id
  WHERE p.is_active OR s.units>0
 ), summaries AS (
  SELECT CASE WHEN paid_at>=start_at THEN 'current' ELSE 'previous' END period,
   jsonb_build_object('revenue',sum(revenue),'shipping',sum(shipping),'orders',count(*),
    'units',sum(units),'average',round(sum(revenue)/nullif(count(*),0),2),
    'estimated_dates',count(*) FILTER(WHERE estimated_date)) value
  FROM order_totals GROUP BY 1
 ), days AS (
  SELECT d::date AS day FROM generate_series(p_from::timestamp,p_to::timestamp,interval '1 day') d
 ), daily AS (
  SELECT (paid_at AT TIME ZONE 'America/Argentina/Buenos_Aires')::date AS day,
   sum(revenue) revenue,count(*) orders FROM order_totals WHERE paid_at>=start_at GROUP BY 1
 ), category_totals AS (
  SELECT category name,sum(quantity) units,sum(line_total) revenue FROM lines WHERE paid_at>=start_at GROUP BY 1
 ), brand_totals AS (
  SELECT brand name,sum(quantity) units,sum(line_total) revenue FROM lines WHERE paid_at>=start_at GROUP BY 1
 ), statuses AS (
  SELECT o.status,count(*) count FROM public.orders o WHERE o.created_at>=start_at AND o.created_at<end_at
   AND ((p_category IS NULL AND p_brand IS NULL) OR EXISTS(
    SELECT 1 FROM public.order_items i JOIN product_scope p ON p.id=i.product_id WHERE i.order_id=o.id))
   GROUP BY o.status
 )
 SELECT jsonb_build_object(
  'current',coalesce((SELECT value FROM summaries WHERE period='current'),'{}'::jsonb),
  'previous',coalesce((SELECT value FROM summaries WHERE period='previous'),'{}'::jsonb),
  'daily',(SELECT jsonb_agg(jsonb_build_object('day',d.day,'revenue',coalesce(s.revenue,0),'orders',coalesce(s.orders,0)) ORDER BY d.day) FROM days d LEFT JOIN daily s USING(day)),
  'products',coalesce((SELECT jsonb_agg(to_jsonb(p) ORDER BY p.units DESC,p.revenue DESC,p.name,p.id) FROM product_rows p),'[]'::jsonb),
  'deleted_product_units',coalesce((SELECT sum(quantity) FROM lines WHERE paid_at>=start_at AND product_id IS NULL),0),
  'categories',coalesce((SELECT jsonb_agg(to_jsonb(c) ORDER BY revenue DESC,name) FROM category_totals c),'[]'::jsonb),
  'brands',coalesce((SELECT jsonb_agg(to_jsonb(b) ORDER BY revenue DESC,name) FROM brand_totals b),'[]'::jsonb),
  'statuses',coalesce((SELECT jsonb_object_agg(status,count) FROM statuses),'{}'::jsonb),
  'unverified_orders',(SELECT count(*) FROM public.orders o WHERE o.status IN ('paid','preparing','shipped','delivered')
   AND o.created_at>=start_at AND o.created_at<end_at AND NOT EXISTS(SELECT 1 FROM verified v WHERE v.id=o.id)
   AND ((p_category IS NULL AND p_brand IS NULL) OR EXISTS(SELECT 1 FROM public.order_items i JOIN product_scope p ON p.id=i.product_id WHERE i.order_id=o.id))),
  'generated_at',now()
 ) INTO result;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.admin_sales_statistics(date,date,uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_sales_statistics(date,date,uuid,uuid) TO authenticated;
