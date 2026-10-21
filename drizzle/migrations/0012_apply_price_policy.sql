CREATE OR REPLACE FUNCTION public.apply_price_policy(p_rows jsonb, p_percentage numeric, p_mode text, p_adjust_compare boolean DEFAULT false)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  r jsonb;
  current_product public.products%ROWTYPE;
  factor numeric;
  next_price numeric;
  next_compare numeric;
  affected integer := 0;
BEGIN
  IF auth.uid() IS NULL OR NOT private.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Solo administradores pueden aplicar políticas de precios.' USING ERRCODE = '42501';
  END IF;
  IF p_mode IS NULL OR p_mode NOT IN ('increase', 'discount') OR p_percentage IS NULL OR p_percentage::text IN ('NaN', 'Infinity', '-Infinity') OR p_percentage <= 0 OR round(p_percentage, 2) <> p_percentage OR (p_mode = 'discount' AND p_percentage > 100) OR p_adjust_compare IS NULL THEN
    RAISE EXCEPTION 'Porcentaje u operación inválidos.';
  END IF;
  IF p_rows IS NULL OR jsonb_typeof(p_rows) <> 'array' THEN RAISE EXCEPTION 'Seleccioná artículos.'; END IF;
  IF jsonb_array_length(p_rows) = 0 OR jsonb_array_length(p_rows) > 10000 THEN RAISE EXCEPTION 'Seleccioná entre 1 y 10000 artículos.'; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_rows) x WHERE jsonb_typeof(x) <> 'object' OR jsonb_typeof(x->'id') IS DISTINCT FROM 'string' OR jsonb_typeof(x->'updated_at') IS DISTINCT FROM 'string') THEN
    RAISE EXCEPTION 'Selección inválida.';
  END IF;
  IF (SELECT count(DISTINCT (x->>'id')::uuid) FROM jsonb_array_elements(p_rows) x) <> jsonb_array_length(p_rows) THEN RAISE EXCEPTION 'Artículos duplicados.'; END IF;
  factor := CASE WHEN p_mode = 'increase' THEN 1 + p_percentage / 100 ELSE 1 - p_percentage / 100 END;
  FOR r IN SELECT x FROM jsonb_array_elements(p_rows) x ORDER BY (x->>'id')::uuid LOOP
    SELECT * INTO current_product FROM public.products WHERE id = (r->>'id')::uuid FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Un artículo ya no existe. Volvé a revisar la selección.'; END IF;
    IF current_product.updated_at IS DISTINCT FROM (r->>'updated_at')::timestamptz THEN
      RAISE EXCEPTION 'Un artículo cambió desde la vista previa. No se actualizó ningún precio; recargá y revisá la selección.';
    END IF;
    next_price := ceil(current_product.price * factor);
    next_compare := CASE WHEN p_adjust_compare THEN ceil(current_product.compare_at_price * factor) ELSE current_product.compare_at_price END;
    IF next_price < 0 OR next_price > 9007199254740991 OR next_compare > 9007199254740991 THEN RAISE EXCEPTION 'Precio resultante fuera de rango.'; END IF;
    IF next_compare <= next_price THEN next_compare := NULL; END IF;
    UPDATE public.products SET price = next_price, compare_at_price = next_compare, updated_at = clock_timestamp() WHERE id = current_product.id;
    affected := affected + 1;
  END LOOP;
  RETURN affected;
END;
$$;
REVOKE ALL ON FUNCTION public.apply_price_policy(jsonb, numeric, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_price_policy(jsonb, numeric, text, boolean) TO authenticated;
COMMENT ON FUNCTION public.apply_price_policy(jsonb, numeric, text, boolean) IS 'Admin-only atomic percentage price updates for explicit product IDs; locks rows, rejects stale previews, and rounds upward to whole pesos.';