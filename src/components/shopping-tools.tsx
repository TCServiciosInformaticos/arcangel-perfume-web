import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useCart, type CartItem } from "@/lib/cart-context";
import { commerce } from "@/lib/commerce-client";
import { repeatPurchase } from "@/lib/commerce.functions";
import { ProductCard } from "@/components/product-card";
import { formatARS } from "@/lib/format";
export function StockNotice({ id }: { id: string }) {
  const { session } = useAuth(),
    send = async ({
      data,
    }: {
      data: { productId: string; cancel?: boolean; accessToken?: string };
    }) => {
      const r = await commerce.rpc("manage_stock_notice", {
        pid: data.productId,
        cancel: data.cancel,
      });
      if (r.error) throw new Error(r.error.message);
      try {
        const status = await fetch("/api/public/restock-notifications");
        if (status.ok) return (await status.json()) as { enabled: boolean };
      } catch {
        /* notices remain saved without provider */
      }
      return { enabled: false };
    };
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  return (
    <div className="mt-3 space-y-2 text-sm">
      <p>¿Querés enterarte cuando vuelva?</p>
      {session ? (
        <>
          <Button
            variant="outline"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                const result = await send({
                  data: { accessToken: session.access_token, productId: id },
                });
                setMessage(
                  typeof result === "object" && result.enabled
                    ? "Solicitud guardada. Te avisaremos al email confirmado de tu cuenta cuando repongamos stock."
                    : "Solicitud guardada. Los envíos se activarán cuando la tienda habilite su servicio de correo.",
                );
              } catch (e) {
                setMessage(e instanceof Error ? e.message : "No se pudo guardar.");
              } finally {
                setBusy(false);
              }
            }}
          >
            Avisame cuando vuelva
          </Button>
          <Button
            variant="ghost"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await send({
                  data: { accessToken: session.access_token, productId: id, cancel: true },
                });
                setMessage("Aviso cancelado.");
              } catch {
                setMessage("No se pudo cancelar.");
              } finally {
                setBusy(false);
              }
            }}
          >
            Cancelar aviso
          </Button>
        </>
      ) : (
        <Link to="/auth" className="text-primary underline">
          Ingresá a tu cuenta para pedir un aviso
        </Link>
      )}
      <p role="status">{message}</p>
    </div>
  );
}
export function RelatedProducts({
  id,
  category,
  brand,
}: {
  id: string;
  category: string | null;
  brand: string | null;
}) {
  const q = useQuery({
    queryKey: ["related-products", id, category, brand],
    enabled: !!category,
    queryFn: async () => {
      let request = supabase
        .from("products")
        .select("id,slug,name,price,stock,image_urls,thumbnail_url")
        .eq("is_active", true)
        .neq("id", id)
        .eq("category_id", category!)
        .order("stock", { ascending: false })
        .order("id")
        .limit(4);
      if (brand) request = request.eq("subcategory_id", brand);
      const r = await request;
      if (r.error) throw r.error;
      return r.data;
    },
  });
  if (!q.data?.length) return null;
  return (
    <section className="mt-12">
      <h2 className="font-serif text-2xl">
        {brand ? "Más de esta marca" : "También te puede interesar"}
      </h2>
      <div className="mt-5 grid grid-cols-2 gap-4 md:grid-cols-4">
        {q.data.map((p) => (
          <ProductCard key={p.id} p={p} />
        ))}
      </div>
    </section>
  );
}
export function RepeatPurchase({ orderId, token }: { orderId: string; token: string }) {
  const load = useServerFn(repeatPurchase),
    { addItem } = useCart(),
    navigate = useNavigate();
  const [preview, setPreview] = useState<{ items: CartItem[]; unavailable: number } | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <section className="mt-6 rounded border p-4 text-left">
      <Button
        variant="outline"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            setPreview(await load({ data: { orderId, token } }));
            setError("");
          } catch (e) {
            setError(e instanceof Error ? e.message : "No se pudo recuperar la compra.");
          } finally {
            setBusy(false);
          }
        }}
      >
        Volver a comprar estos artículos
      </Button>
      {preview && (
        <>
          <p className="mt-3 text-sm">
            Precios y stock actuales. Los combos se repiten como artículos individuales, sin
            promociones anteriores.
          </p>
          <ul className="my-3 text-sm">
            {preview.items.map((p) => (
              <li key={p.productId}>
                {p.quantity} × {p.name} · {formatARS(p.price)}
              </li>
            ))}
          </ul>
          {preview.unavailable > 0 && (
            <p className="text-sm">{preview.unavailable} artículo(s) ya no disponibles.</p>
          )}
          <Button
            disabled={!preview.items.length}
            onClick={() => {
              preview.items.forEach((p) => addItem(p, p.quantity));
              void navigate({ to: "/carrito" });
            }}
          >
            Agregar disponibles al carrito
          </Button>
        </>
      )}
      {error && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {error}
        </p>
      )}
    </section>
  );
}
