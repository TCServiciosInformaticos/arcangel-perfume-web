-- Editable business code stays separate from immutable IDs and public URLs.
ALTER TABLE public.products ADD COLUMN article_code text;
UPDATE public.products SET article_code=slug;
ALTER TABLE public.products ADD CONSTRAINT products_article_code_format CHECK (article_code IS NULL OR (article_code=btrim(article_code) AND length(article_code) BETWEEN 1 AND 100));
ALTER TABLE public.products ADD CONSTRAINT products_article_code_key UNIQUE(article_code) DEFERRABLE INITIALLY IMMEDIATE;

CREATE OR REPLACE FUNCTION public.update_products_from_excel(rows jsonb)
RETURNS integer LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE item jsonb; total integer; affected integer;
BEGIN
  IF auth.uid() IS NULL OR NOT private.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Solo administradores pueden importar artículos';
  END IF;
  IF jsonb_typeof(rows) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Formato de archivo inválido'; END IF;
  total:=jsonb_array_length(rows);
  IF total=0 OR total>10000 THEN RAISE EXCEPTION 'Archivo vacío o demasiado grande'; END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(rows) LOOP
    IF jsonb_typeof(item->'id') IS DISTINCT FROM 'string' OR jsonb_typeof(item->'price') IS DISTINCT FROM 'number' OR jsonb_typeof(item->'stock') IS DISTINCT FROM 'number' OR jsonb_typeof(item->'is_active') IS DISTINCT FROM 'boolean' THEN
      RAISE EXCEPTION 'Datos de artículo inválidos';
    END IF;
    IF (item->>'price')::numeric < 0 OR (item->>'price')::numeric > 999999999 OR (item->>'stock')::numeric < 0 OR (item->>'stock')::numeric > 2147483647 OR (item->>'stock')::numeric <> trunc((item->>'stock')::numeric) THEN
      RAISE EXCEPTION 'Precio o stock inválido';
    END IF;
    IF item ? 'name' AND (jsonb_typeof(item->'name') IS DISTINCT FROM 'string' OR length(btrim(item->>'name')) NOT BETWEEN 1 AND 500) THEN RAISE EXCEPTION 'Descripción del artículo inválida'; END IF;
    IF item ? 'description' AND (jsonb_typeof(item->'description') IS DISTINCT FROM 'string' OR length(item->>'description')>32767) THEN RAISE EXCEPTION 'Descripción detallada inválida'; END IF;
    IF item ? 'article_code' AND item->'article_code'<>'null'::jsonb AND (jsonb_typeof(item->'article_code') IS DISTINCT FROM 'string' OR length(btrim(item->>'article_code')) NOT BETWEEN 1 AND 100) THEN RAISE EXCEPTION 'Código del artículo inválido'; END IF;
    PERFORM (item->>'id')::uuid;
  END LOOP;
  IF (SELECT count(DISTINCT (value->>'id')::uuid) FROM jsonb_array_elements(rows))<>total THEN RAISE EXCEPTION 'Artículos repetidos'; END IF;
  SET CONSTRAINTS products_article_code_key DEFERRED;
  UPDATE public.products p SET
    name=CASE WHEN r.item ? 'name' THEN btrim(r.item->>'name') ELSE p.name END,
    description=CASE WHEN r.item ? 'description' THEN r.item->>'description' ELSE p.description END,
    article_code=CASE WHEN r.item ? 'article_code' THEN nullif(btrim(r.item->>'article_code'),'') ELSE p.article_code END,
    price=(r.item->>'price')::numeric, stock=(r.item->>'stock')::integer, is_active=(r.item->>'is_active')::boolean,
    updated_at=now()
  FROM jsonb_array_elements(rows) AS r(item) WHERE p.id=(r.item->>'id')::uuid;
  GET DIAGNOSTICS affected=ROW_COUNT;
  IF affected<>total THEN RAISE EXCEPTION 'Uno o más artículos ya no existen; no se guardó ningún cambio'; END IF;
  BEGIN
    SET CONSTRAINTS products_article_code_key IMMEDIATE;
  EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION 'Código del artículo repetido; no se guardó ningún cambio';
  END;
  RETURN affected;
END;
$$;
REVOKE ALL ON FUNCTION public.update_products_from_excel(jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.update_products_from_excel(jsonb) TO authenticated;
NOTIFY pgrst,'reload schema';
