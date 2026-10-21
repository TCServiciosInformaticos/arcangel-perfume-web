CREATE TABLE public.home_slides (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 title text NOT NULL CHECK(length(btrim(title)) BETWEEN 1 AND 100),
 subtitle text NOT NULL DEFAULT '' CHECK(length(subtitle)<=500),
 alt_text text NOT NULL DEFAULT '' CHECK(length(alt_text)<=200),
 image_path text NOT NULL CHECK(image_path IN ('builtin:hero-banner-red','builtin:hero-ofertas','builtin:hero-perfumes-bodegon','builtin:hero-limpieza','builtin:hero-cabello-vanity','builtin:hero-higiene','builtin:hero-accesorios','builtin:hero-skincare','builtin:hero-makeup') OR image_path ~ '^[a-f0-9-]{36}[.]webp$'),
 mobile_position integer NOT NULL DEFAULT 50 CHECK(mobile_position BETWEEN 0 AND 100),
 destination text NOT NULL DEFAULT 'catalog' CHECK(destination IN ('catalog','offers','category')),
 category_id uuid REFERENCES public.categories(id),
 is_active boolean NOT NULL DEFAULT true,
 sort_order integer NOT NULL CHECK(sort_order>=0),
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT home_slides_destination CHECK((destination='category' AND category_id IS NOT NULL) OR(destination<>'category' AND category_id IS NULL)),
 CONSTRAINT home_slides_sort_order_key UNIQUE(sort_order) DEFERRABLE INITIALLY IMMEDIATE
);
ALTER TABLE public.home_slides ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.home_slides FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.home_slides TO anon,authenticated;
GRANT INSERT,UPDATE,DELETE ON public.home_slides TO authenticated;
GRANT ALL ON public.home_slides TO service_role;
CREATE POLICY public_read_visible_home_slides ON public.home_slides FOR SELECT TO anon,authenticated USING(is_active);
CREATE POLICY admins_manage_home_slides ON public.home_slides FOR ALL TO authenticated USING(private.has_role(auth.uid(),'admin')) WITH CHECK(private.has_role(auth.uid(),'admin'));
CREATE TRIGGER set_updated_at_home_slides BEFORE UPDATE ON public.home_slides FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

INSERT INTO public.home_slides(title,subtitle,alt_text,image_path,mobile_position,destination,category_id,sort_order)
SELECT v.title,v.subtitle,v.title,'builtin:'||v.asset,v.position,v.destination,c.id,v.sort_order
FROM (VALUES
 ('El Arcángel','Tu perfumería de barrio, ahora también online','hero-banner-red',50,'catalog',NULL,0),
 ('Ofertas','Aprovechá los precios que bajaron, por tiempo limitado','hero-ofertas',80,'offers',NULL,1),
 ('Perfumes','La fragancia que te representa está acá','hero-perfumes-bodegon',90,'category','perfumes',2),
 ('Limpieza','Tu casa impecable, sin salir de casa','hero-limpieza',90,'category','limpieza',3),
 ('Cuidado Capilar','Todo lo que tu pelo necesita, en un solo lugar','hero-cabello-vanity',80,'category','cabello',4),
 ('Cuidado Personal','Cuidado diario para toda la familia','hero-higiene',90,'category','higiene-personal',5),
 ('Accesorios','Los detalles que completan tu rutina','hero-accesorios',90,'category','accesorios',6),
 ('Skin care','El cuidado que tu piel pide cada día','hero-skincare',90,'category','skin-care',7),
 ('Make up','Los colores que te acompañan todos los días','hero-makeup',90,'category','make-up',8)
) AS v(title,subtitle,asset,position,destination,category_slug,sort_order)
LEFT JOIN categories c ON c.slug=v.category_slug;

INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES('slider-images','slider-images',true,10485760,ARRAY['image/webp']);
CREATE POLICY public_read_slider_images ON storage.objects FOR SELECT TO anon,authenticated USING(bucket_id='slider-images');
CREATE POLICY admins_upload_slider_images ON storage.objects FOR INSERT TO authenticated WITH CHECK(bucket_id='slider-images' AND private.has_role(auth.uid(),'admin'));
CREATE POLICY admins_update_slider_images ON storage.objects FOR UPDATE TO authenticated USING(bucket_id='slider-images' AND private.has_role(auth.uid(),'admin')) WITH CHECK(bucket_id='slider-images' AND private.has_role(auth.uid(),'admin'));
CREATE POLICY admins_delete_slider_images ON storage.objects FOR DELETE TO authenticated USING(bucket_id='slider-images' AND private.has_role(auth.uid(),'admin'));

CREATE FUNCTION public.save_home_slide(slide jsonb,expected_updated_at timestamptz DEFAULT NULL) RETURNS uuid
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE sid uuid; existing home_slides%ROWTYPE; new_order integer;
BEGIN
 IF auth.uid() IS NULL OR NOT private.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Solo administradores pueden editar el slider'; END IF;
 PERFORM pg_advisory_xact_lock(78399024);
 IF jsonb_typeof(slide) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Diapositiva inválida'; END IF;
 IF slide->>'id' IS NULL THEN
  IF (SELECT count(*) FROM home_slides)>=50 THEN RAISE EXCEPTION 'El slider admite hasta 50 diapositivas'; END IF;
  SELECT coalesce(max(sort_order),-1)+1 INTO new_order FROM home_slides;
  INSERT INTO home_slides(title,subtitle,alt_text,image_path,mobile_position,destination,category_id,is_active,sort_order)
  VALUES(btrim(slide->>'title'),coalesce(slide->>'subtitle',''),coalesce(slide->>'alt_text',''),slide->>'image_path',(slide->>'mobile_position')::integer,slide->>'destination',(slide->>'category_id')::uuid,(slide->>'is_active')::boolean,new_order) RETURNING id INTO sid;
 ELSE
  sid:=(slide->>'id')::uuid;
  SELECT * INTO existing FROM home_slides WHERE id=sid FOR UPDATE;
  IF existing.id IS NULL OR existing.updated_at IS DISTINCT FROM expected_updated_at THEN RAISE EXCEPTION 'La diapositiva cambió o fue eliminada. Actualizá la lista antes de guardar'; END IF;
  UPDATE home_slides SET title=btrim(slide->>'title'),subtitle=coalesce(slide->>'subtitle',''),alt_text=coalesce(slide->>'alt_text',''),image_path=slide->>'image_path',mobile_position=(slide->>'mobile_position')::integer,destination=slide->>'destination',category_id=(slide->>'category_id')::uuid,is_active=(slide->>'is_active')::boolean WHERE id=sid;
 END IF;
 RETURN sid;
END $$;
CREATE FUNCTION public.reorder_home_slides(slides jsonb) RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE total integer;
BEGIN
 IF auth.uid() IS NULL OR NOT private.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Solo administradores pueden ordenar el slider'; END IF;
 PERFORM pg_advisory_xact_lock(78399024);
 PERFORM id FROM home_slides ORDER BY id FOR UPDATE;
 IF jsonb_typeof(slides) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Orden inválido'; END IF;
 total:=jsonb_array_length(slides);
 IF total<>(SELECT count(*) FROM home_slides) OR total>50 OR (SELECT count(DISTINCT (value->>'id')::uuid) FROM jsonb_array_elements(slides))<>total THEN RAISE EXCEPTION 'La lista cambió. Actualizala antes de guardar el orden'; END IF;
 IF (SELECT count(*) FROM jsonb_array_elements(slides) x JOIN home_slides s ON s.id=(x->>'id')::uuid AND s.updated_at=(x->>'updated_at')::timestamptz)<>total THEN RAISE EXCEPTION 'Una diapositiva cambió. Actualizá la lista antes de guardar el orden'; END IF;
 SET CONSTRAINTS home_slides_sort_order_key DEFERRED;
 UPDATE home_slides s SET sort_order=x.position-1 FROM (SELECT value,ordinality::integer AS position FROM jsonb_array_elements(slides) WITH ORDINALITY) x WHERE s.id=(x.value->>'id')::uuid;
 SET CONSTRAINTS home_slides_sort_order_key IMMEDIATE;
END $$;
CREATE FUNCTION public.delete_home_slide(slide_id uuid,expected_updated_at timestamptz) RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT private.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Solo administradores pueden eliminar diapositivas'; END IF;
 PERFORM pg_advisory_xact_lock(78399024);
 DELETE FROM home_slides WHERE id=slide_id AND updated_at=expected_updated_at;
 IF NOT FOUND THEN RAISE EXCEPTION 'La diapositiva cambió o fue eliminada. Actualizá la lista'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.save_home_slide(jsonb,timestamptz),public.reorder_home_slides(jsonb),public.delete_home_slide(uuid,timestamptz) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_home_slide(jsonb,timestamptz),public.reorder_home_slides(jsonb),public.delete_home_slide(uuid,timestamptz) TO authenticated;
NOTIFY pgrst,'reload schema';

-- Existing product policies must use the granted private role helper too:
-- PostgreSQL may evaluate every permissive policy during a slider upload.
ALTER POLICY "Admins upload product images" ON storage.objects WITH CHECK(bucket_id='product-images' AND private.has_role(auth.uid(),'admin'));
ALTER POLICY "Admins update product images" ON storage.objects USING(bucket_id='product-images' AND private.has_role(auth.uid(),'admin')) WITH CHECK(bucket_id='product-images' AND private.has_role(auth.uid(),'admin'));
ALTER POLICY "Admins delete product images" ON storage.objects USING(bucket_id='product-images' AND private.has_role(auth.uid(),'admin'));
