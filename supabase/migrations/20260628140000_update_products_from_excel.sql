-- Atomic bulk product update function for Excel imports
-- Admin-checked SECURITY INVOKER function that updates only price, stock, and is_active
CREATE OR REPLACE FUNCTION public.update_products_from_excel(rows jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  _row jsonb;
  _updated_count integer := 0;
  _id uuid;
  _price numeric;
  _stock integer;
  _is_active boolean;
BEGIN
  -- Admin privilege check
  IF NOT private.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Solo administradores pueden actualizar productos desde Excel';
  END IF;

  IF jsonb_typeof(rows) <> 'array' THEN
    RAISE EXCEPTION 'El formato de datos debe ser un arreglo';
  END IF;

  FOR _row IN SELECT * FROM jsonb_array_elements(rows)
  LOOP
    _id := (_row->>'id')::uuid;
    _price := (_row->>'price')::numeric;
    _stock := (_row->>'stock')::integer;
    _is_active := (_row->>'is_active')::boolean;

    IF _price IS NULL OR _price <= 0 THEN
      RAISE EXCEPTION 'Precio inválido para el producto %', _id;
    END IF;

    IF _stock IS NULL OR _stock < 0 THEN
      RAISE EXCEPTION 'Stock inválido para el producto %', _id;
    END IF;

    IF _is_active IS NULL THEN
      RAISE EXCEPTION 'Estado activo inválido para el producto %', _id;
    END IF;

    -- Update only price, absolute stock balance and visibility (is_active)
    UPDATE public.products
    SET
      price = _price,
      stock = _stock,
      is_active = _is_active,
      updated_at = now()
    WHERE id = _id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Producto con ID % no encontrado', _id;
    END IF;

    _updated_count := _updated_count + 1;
  END LOOP;

  RETURN _updated_count;
END;
$$;

REVOKE ALL ON FUNCTION public.update_products_from_excel(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_products_from_excel(jsonb) TO authenticated, service_role;
