CREATE TABLE public.brands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  logo_url text,
  website text,
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.brands TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.brands TO authenticated;
GRANT ALL ON public.brands TO service_role;
ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public reads active brands" ON public.brands FOR SELECT TO anon, authenticated USING (is_active OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage brands" ON public.brands FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
INSERT INTO public.brands (name, website, sort_order) VALUES
('L''Oréal','loreal-paris.com.ar',1),('Nivea','nivea.com.ar',2),('Dove','dove.com',3),('Maybelline','maybelline.com',4),('Garnier','garnier.com.ar',5),('Pantene','pantene.com',6),('Sedal','sedal.com.ar',7),('Rexona','rexona.com',8),('Colgate','colgate.com',9),('Ala','ala.com.ar',10),('Antonio Banderas','antoniobanderasfragrances.com',11),('Elvive','elvive.com.ar',12);
UPDATE public.brands SET logo_url = 'https://www.google.com/s2/favicons?sz=128&domain=' || website;