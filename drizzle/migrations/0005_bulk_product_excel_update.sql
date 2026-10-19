CREATE OR REPLACE FUNCTION public.update_products_from_excel(rows jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE item jsonb; total integer; affected integer;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Solo administradores pueden importar artículos';
  END IF;
  IF jsonb_typeof(rows) IS DISTINCT FROM 'array' OR jsonb_array_length(rows) = 0 OR jsonb_array_length(rows) > 10000 THEN
    RAISE EXCEPTION 'Archivo vacío o demasiado grande';
  END IF;
  total := jsonb_array_length(rows);
  FOR item IN SELECT value FROM jsonb_array_elements(rows) LOOP
    IF jsonb_typeof(item->'id') IS DISTINCT FROM 'string' OR jsonb_typeof(item->'price') IS DISTINCT FROM 'number' OR jsonb_typeof(item->'stock') IS DISTINCT FROM 'number' OR jsonb_typeof(item->'is_active') IS DISTINCT FROM 'boolean' THEN
      RAISE EXCEPTION 'Datos de artículo inválidos';
    END IF;
    IF (item->>'price')::numeric <= 0 OR (item->>'price')::numeric > 999999999 OR (item->>'stock')::numeric < 0 OR (item->>'stock')::numeric > 2147483647 OR (item->>'stock')::numeric <> trunc((item->>'stock')::numeric) THEN
      RAISE EXCEPTION 'Precio o stock inválido';
    END IF;
    PERFORM (item->>'id')::uuid;
  END LOOP;
  IF (SELECT count(DISTINCT value->>'id') FROM jsonb_array_elements(rows)) <> total THEN
    RAISE EXCEPTION 'Artículos repetidos';
  END IF;
  UPDATE public.products p SET price = r.price, stock = r.stock, is_active = r.is_active
  FROM jsonb_to_recordset(rows) AS r(id uuid, price numeric, stock integer, is_active boolean)
  WHERE p.id = r.id;
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> total THEN RAISE EXCEPTION 'Uno o más artículos ya no existen; no se guardó ningún cambio'; END IF;
  RETURN affected;
END;
$$;
REVOKE ALL ON FUNCTION public.update_products_from_excel(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_products_from_excel(jsonb) TO authenticated;