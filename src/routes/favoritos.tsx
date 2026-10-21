import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useFavorites } from "@/components/favorites";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { ProductCard } from "@/components/product-card";
export const Route = createFileRoute("/favoritos")({ component: Favorites });
function Favorites() {
  const { ids } = useFavorites();
  const q = useQuery({
    queryKey: ["favorites", ids],
    enabled: ids.length > 0,
    queryFn: async () => {
      const r = await supabase
        .from("products")
        .select("id,slug,name,price,stock,image_urls,thumbnail_url")
        .in("id", ids)
        .eq("is_active", true);
      if (r.error) throw r.error;
      return r.data;
    },
  });
  return (
    <>
      <SiteHeader />
      <main className="mx-auto min-h-[60vh] max-w-6xl p-6">
        <h1 className="font-serif text-3xl">Mis favoritos</h1>
        <p className="my-3 text-sm text-muted-foreground">
          Se guardan en este navegador. Los productos retirados de la web no se muestran.
        </p>
        {q.isError ? (
          <p role="alert">No se pudieron cargar tus favoritos.</p>
        ) : ids.length === 0 ? (
          <p>
            Todavía no guardaste artículos.{" "}
            <Link to="/productos" className="underline">
              Explorá el catálogo
            </Link>
            .
          </p>
        ) : q.isPending ? (
          <p>Cargando…</p>
        ) : (
          <div className="grid grid-cols-2 gap-5 md:grid-cols-4">
            {q.data?.map((p) => (
              <ProductCard key={p.id} p={p} />
            ))}
          </div>
        )}
      </main>
      <SiteFooter />
    </>
  );
}
