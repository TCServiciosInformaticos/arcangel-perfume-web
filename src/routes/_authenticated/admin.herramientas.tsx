import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { commerce, type Bundle, type Coupon } from "@/lib/commerce-client";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { useAuth } from "@/lib/auth-context";
import { applyAdminProductSearch } from "@/lib/admin-product-search";
import { formatARS } from "@/lib/format";
import { buenosAiresDate, shiftDate, validateSalesDates } from "@/lib/sales-statistics";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
export const Route = createFileRoute("/_authenticated/admin/herramientas")({
  component: CommerceAdmin,
});
const field = "h-10 rounded border bg-background px-2 text-sm";
const err = (e: unknown) =>
  e && typeof e === "object" && "message" in e
    ? String(e.message)
    : "No se pudo completar la operación";
async function save(action: string, payload: object) {
  const r = await commerce.rpc("admin_commerce", { action, payload: payload as Json });
  if (r.error) throw r.error;
  return r.data;
}
function CommerceAdmin() {
  const [tab, setTab] = useState("combos");
  const { isAdmin } = useAuth();
  if (!isAdmin) return null;
  return (
    <div className="space-y-6">
      <h1 className="font-serif text-3xl">Herramientas de venta</h1>
      <div className="flex flex-wrap gap-2">
        {[
          ["combos", "Combos y kits"],
          ["coupons", "Cupones"],
          ["costs", "Costos y escáner"],
          ["picking", "Preparar pedidos"],
          ["margin", "Rentabilidad"],
          ["notices", "Avisos de reposición"],
        ].map(([id, label]) => (
          <Button key={id} variant={tab === id ? "default" : "outline"} onClick={() => setTab(id)}>
            {label}
          </Button>
        ))}
      </div>
      {tab === "combos" ? (
        <BundleEditor />
      ) : tab === "coupons" ? (
        <CouponEditor />
      ) : tab === "costs" ? (
        <CostEditor />
      ) : tab === "picking" ? (
        <Picking />
      ) : tab === "margin" ? (
        <MarginReport />
      ) : (
        <Notices />
      )}
    </div>
  );
}
type Product = {
  id: string;
  name: string;
  article_code: string | null;
  barcode: string | null;
  price: number;
  stock: number;
  updated_at: string;
};
function ProductPicker({ onSelect }: { onSelect: (p: Product) => void }) {
  const [term, setTerm] = useState("");
  const q = useQuery({
    queryKey: ["admin", "commerce-product-search", term],
    enabled: term.trim().length >= 2,
    queryFn: async () => {
      const r = await applyAdminProductSearch(
        supabase
          .from("products")
          .select("id,name,price,stock,article_code,barcode,updated_at")
          .order("name")
          .limit(20),
        term,
      );
      if (r.error) throw r.error;
      return r.data;
    },
  });
  return (
    <div className="space-y-2">
      <label className="text-sm">
        Buscar artículo por nombre, código o barras
        <Input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Escribí o escaneá y elegí el artículo"
        />
      </label>
      {q.isError && <p role="alert">No se pudo buscar.</p>}
      {q.data && (
        <ul className="max-h-48 overflow-auto rounded border">
          {q.data.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                className="w-full border-b p-2 text-left text-sm hover:bg-secondary"
                onClick={() => {
                  onSelect(p);
                  setTerm("");
                }}
              >
                {p.name} · {p.article_code || "Sin código"} · Stock {p.stock}
              </button>
            </li>
          ))}
          {!q.data.length && <li className="p-2 text-sm">Sin resultados.</li>}
        </ul>
      )}
    </div>
  );
}
function BundleEditor() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Bundle | null>(null),
    [name, setName] = useState(""),
    [description, setDescription] = useState(""),
    [price, setPrice] = useState(""),
    [active, setActive] = useState(false),
    [busy, setBusy] = useState(false),
    [parts, setParts] = useState<{ product_id: string; name: string; quantity: number }[]>([]);
  const q = useQuery({
    queryKey: ["admin", "bundles"],
    queryFn: async () => {
      const [b, c] = await Promise.all([
        commerce.from("bundles").select("*").order("name"),
        commerce.from("bundle_components").select("*"),
      ]);
      if (b.error || c.error) throw b.error || c.error;
      return { bundles: b.data ?? [], components: c.data ?? [] };
    },
  });
  function reset() {
    setEditing(null);
    setName("");
    setDescription("");
    setPrice("");
    setActive(false);
    setParts([]);
  }
  return (
    <section className="space-y-4 rounded-xl border bg-card p-4">
      <h2 className="font-serif text-2xl">Combos y kits</h2>
      <p className="text-sm text-muted-foreground">
        El precio del combo reemplaza la suma de sus artículos. La reserva y el descuento de stock
        se hacen por componente. No admite combos dentro de otros combos.
      </p>
      {q.isError && <p role="alert">No se pudieron cargar los combos.</p>}
      <div className="flex flex-wrap gap-2">
        {q.data?.bundles.map((b) => (
          <Button
            size="sm"
            variant="outline"
            key={b.id}
            onClick={async () => {
              setEditing(b);
              setName(b.name);
              setDescription(b.description);
              setPrice(String(b.price));
              setActive(b.is_active);
              const cs = q.data.components.filter((c) => c.bundle_id === b.id);
              const p = await supabase
                .from("products")
                .select("id,name")
                .in(
                  "id",
                  cs.map((c) => c.product_id),
                );
              setParts(
                cs.map((c) => ({
                  ...c,
                  name: p.data?.find((x) => x.id === c.product_id)?.name ?? c.product_id,
                })),
              );
            }}
          >
            {b.name} {b.is_active ? "· Visible" : "· Oculto"}
          </Button>
        ))}
      </div>
      <form
        className="space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await save("bundle", {
              id: editing?.id,
              name,
              description,
              price: Number(price),
              is_active: active,
              components: parts,
              expected_updated_at: editing?.updated_at,
            });
            await qc.invalidateQueries({ queryKey: ["admin", "bundles"] });
            await qc.invalidateQueries({ queryKey: ["store-bundles"] });
            reset();
            toast.success("Combo guardado");
          } catch (e) {
            toast.error(err(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        <label className="block text-sm">
          Nombre
          <Input value={name} maxLength={160} required onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="block text-sm">
          Descripción
          <Input
            value={description}
            maxLength={1000}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        <label className="block text-sm">
          Precio final del combo (ARS)
          <Input
            type="number"
            min="0.01"
            step="0.01"
            value={price}
            required
            onChange={(e) => setPrice(e.target.value)}
          />
        </label>
        <ProductPicker
          onSelect={(p) =>
            setParts((old) =>
              old.some((c) => c.product_id === p.id)
                ? old
                : [...old, { product_id: p.id, name: p.name, quantity: 1 }],
            )
          }
        />
        <ul>
          {parts.map((p) => (
            <li className="my-2 flex flex-wrap items-center gap-2 text-sm" key={p.product_id}>
              <span className="flex-1">{p.name}</span>
              <Input
                aria-label={`Cantidad de ${p.name}`}
                className="w-20"
                type="number"
                min={1}
                max={20}
                value={p.quantity}
                onChange={(e) =>
                  setParts((old) =>
                    old.map((x) =>
                      x.product_id === p.product_id
                        ? { ...x, quantity: Number(e.target.value) }
                        : x,
                    ),
                  )
                }
              />
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setParts((old) => old.filter((x) => x.product_id !== p.product_id))}
              >
                Quitar
              </Button>
            </li>
          ))}
        </ul>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
          Visible en Combos
        </label>
        <div className="flex gap-2">
          <Button disabled={busy || parts.length < 2}>
            {busy ? "Guardando…" : "Guardar combo"}
          </Button>
          <Button type="button" variant="outline" onClick={reset}>
            Nuevo combo
          </Button>
        </div>
      </form>
    </section>
  );
}
const freshCoupon = (): Coupon => ({
  code: "",
  kind: "percent",
  value: 10,
  minimum: 0,
  category_id: null,
  starts_at: new Date().toISOString(),
  ends_at: new Date(Date.now() + 7 * 86400000).toISOString(),
  max_uses: 100,
  per_customer: 1,
  first_purchase: false,
  is_active: false,
  updated_at: "",
});
function CouponEditor() {
  const qc = useQueryClient();
  const [draft, setDraft] = useState(freshCoupon),
    [busy, setBusy] = useState(false);
  const q = useQuery({
    queryKey: ["admin", "coupons"],
    queryFn: async () => {
      const r = await commerce.from("coupons").select("*").order("code");
      if (r.error) throw r.error;
      return r.data;
    },
  });
  const cats = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const r = await supabase.from("categories").select("id,name").order("sort_order");
      if (r.error) throw r.error;
      return r.data;
    },
  });
  return (
    <section className="space-y-4 rounded-xl border bg-card p-4">
      <h2 className="font-serif text-2xl">Cupones</h2>
      <p className="text-sm">
        Requieren cuenta con email confirmado. Los límites cuentan pagos aprobados y reservas
        vigentes. Un cupón vencido deja de aplicarse automáticamente; los pagos ya iniciados
        conservan su precio durante la reserva.
      </p>
      {q.isError && <p role="alert">No se pudieron cargar los cupones.</p>}
      <div className="flex flex-wrap gap-2">
        {q.data?.map((c) => (
          <Button key={c.code} variant="outline" size="sm" onClick={() => setDraft(c)}>
            {c.code} {c.is_active ? "· Activo" : "· Inactivo"}
          </Button>
        ))}
      </div>
      <form
        className="grid gap-3 sm:grid-cols-2"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await save("coupon", { ...draft, expected_updated_at: draft.updated_at || undefined });
            await qc.invalidateQueries({ queryKey: ["admin", "coupons"] });
            setDraft(freshCoupon());
            toast.success("Cupón guardado");
          } catch (e) {
            toast.error(err(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        <label className="text-sm">
          Código
          <Input
            required
            disabled={!!draft.updated_at}
            pattern="[A-Z0-9_-]{3,30}"
            maxLength={30}
            value={draft.code}
            onChange={(e) => setDraft({ ...draft, code: e.target.value.toUpperCase() })}
          />
        </label>
        <label className="text-sm">
          Tipo
          <select
            className={`${field} block w-full`}
            value={draft.kind}
            onChange={(e) => setDraft({ ...draft, kind: e.target.value as Coupon["kind"] })}
          >
            <option value="percent">Porcentaje</option>
            <option value="fixed">Importe fijo ARS</option>
          </select>
        </label>
        {(
          [
            ["value", "Descuento"],
            ["minimum", "Compra mínima ARS"],
            ["max_uses", "Usos totales"],
            ["per_customer", "Usos por cuenta"],
          ] as const
        ).map(([k, label]) => (
          <label key={k} className="text-sm">
            {label}
            <Input
              required
              type="number"
              min={k === "minimum" ? 0 : 1}
              step={k === "value" || k === "minimum" ? "0.01" : 1}
              value={draft[k]}
              onChange={(e) => setDraft({ ...draft, [k]: Number(e.target.value) })}
            />
          </label>
        ))}
        <label className="text-sm">
          Categoría
          <select
            className={`${field} block w-full`}
            value={draft.category_id ?? ""}
            onChange={(e) => setDraft({ ...draft, category_id: e.target.value || null })}
          >
            <option value="">Todas</option>
            {cats.data?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        {(["starts_at", "ends_at"] as const).map((k) => (
          <label key={k} className="text-sm">
            {k === "starts_at" ? "Desde" : "Hasta"} (hora argentina)
            <Input
              type="datetime-local"
              required
              value={new Date(new Date(draft[k]).getTime() - 3 * 3600000)
                .toISOString()
                .slice(0, 16)}
              onChange={(e) => {
                if (e.target.value)
                  setDraft({ ...draft, [k]: new Date(e.target.value + "-03:00").toISOString() });
              }}
            />
          </label>
        ))}
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={draft.first_purchase}
            onChange={(e) => setDraft({ ...draft, first_purchase: e.target.checked })}
          />
          Solo primera compra de la cuenta
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={draft.is_active}
            onChange={(e) => setDraft({ ...draft, is_active: e.target.checked })}
          />
          Activo
        </label>
        <div className="flex gap-2 sm:col-span-2">
          <Button disabled={busy}>Guardar cupón</Button>
          <Button type="button" variant="outline" onClick={() => setDraft(freshCoupon())}>
            Nuevo cupón
          </Button>
        </div>
      </form>
    </section>
  );
}
function CostEditor() {
  const qc = useQueryClient();
  const [p, setP] = useState<Product | null>(null),
    [cost, setCost] = useState(""),
    [barcode, setBarcode] = useState(""),
    [busy, setBusy] = useState(false);
  const [loadedCost, setLoadedCost] = useState<{ id: string; version?: string } | null>(null);
  const current = useQuery({
    queryKey: ["admin", "cost", p?.id],
    enabled: !!p,
    queryFn: async () => {
      const r = await commerce
        .from("product_costs")
        .select("*")
        .eq("product_id", p!.id)
        .maybeSingle();
      if (r.error) throw r.error;
      return r.data;
    },
  });
  useEffect(() => {
    if (p && current.isSuccess && !current.isFetching && loadedCost?.id !== p.id) {
      setCost(current.data ? String(current.data.unit_cost) : "");
      setLoadedCost({ id: p.id, version: current.data?.updated_at });
    }
  }, [current.data, current.isSuccess, current.isFetching, p?.id, loadedCost?.id]);
  return (
    <section className="space-y-4 rounded-xl border bg-card p-4">
      <h2 className="font-serif text-2xl">Costos y códigos de barras</h2>
      <p className="text-sm">
        El lector USB funciona como teclado. También podés usar la cámara si tu navegador reconoce
        códigos. Los costos son privados del admin; no se publican en la tienda.
      </p>
      <CameraScanner
        onRead={async (code) => {
          const r = await supabase
            .from("products")
            .select("id,name,price,stock,article_code,barcode,updated_at")
            .eq("barcode", code)
            .maybeSingle();
          if (r.error || !r.data)
            toast.error("Código no encontrado. Buscá el artículo y asignale ese código.");
          else {
            setLoadedCost(null);
            void qc.invalidateQueries({ queryKey: ["admin", "cost", r.data.id] });
            setP(r.data);
            setBarcode(r.data.barcode ?? "");
          }
        }}
      />
      <ProductPicker
        onSelect={(p) => {
          setLoadedCost(null);
          void qc.invalidateQueries({ queryKey: ["admin", "cost", p.id] });
          setP(p);
          setBarcode(p.barcode ?? "");
        }}
      />
      {p && current.isError && (
        <p role="alert">No se pudo cargar el costo. Volvé a buscar el artículo.</p>
      )}
      {p && loadedCost?.id !== p.id && !current.isError && <p role="status">Cargando costo…</p>}
      {p && loadedCost?.id === p.id && (
        <form
          className="space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              const saved = await save("cost", {
                product_id: p.id,
                unit_cost: cost,
                barcode,
                expected_updated_at: loadedCost.version,
                expected_product_updated_at: p.updated_at,
              });
              const version = saved as {
                cost_updated_at: string | null;
                product_updated_at: string;
              };
              setLoadedCost({ id: p.id, version: version.cost_updated_at ?? undefined });
              setP({ ...p, barcode: barcode || null, updated_at: version.product_updated_at });
              await qc.invalidateQueries({ queryKey: ["admin", "cost", p.id] });
              toast.success("Costo y código guardados");
            } catch (e) {
              toast.error(err(e));
            } finally {
              setBusy(false);
            }
          }}
        >
          <h3 className="font-semibold">{p.name}</h3>
          <p className="text-sm">
            Precio actual {formatARS(p.price)} · Stock {p.stock}
          </p>
          <label className="block text-sm">
            Código de barras
            <Input
              value={barcode}
              pattern="[0-9]{8,14}"
              maxLength={14}
              placeholder="EAN / UPC (8 a 14 dígitos)"
              onChange={(e) => setBarcode(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            Costo unitario ARS
            <Input
              type="number"
              min={0}
              step="0.01"
              value={cost}
              placeholder="Sin costo cargado"
              onChange={(e) => setCost(e.target.value)}
            />
          </label>
          <p className="text-xs text-muted-foreground">
            Dejar el costo vacío conserva el existente. Los pedidos nuevos guardan una copia del
            costo; los anteriores no se recalculan.
          </p>
          <Button disabled={busy || current.isFetching || current.isError}>
            Guardar costo y código
          </Button>
        </form>
      )}
    </section>
  );
}
type Detector = { detect: (v: HTMLVideoElement) => Promise<{ rawValue: string }[]> };
function CameraScanner({ onRead }: { onRead: (code: string) => void }) {
  const video = useRef<HTMLVideoElement>(null),
    stream = useRef<MediaStream | null>(null),
    timer = useRef<ReturnType<typeof setTimeout> | null>(null),
    running = useRef(false),
    mounted = useRef(true);
  const [active, setActive] = useState(false),
    [message, setMessage] = useState("");
  function stop() {
    running.current = false;
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    if (timer.current) clearTimeout(timer.current);
    setActive(false);
  }
  useEffect(
    () => () => {
      mounted.current = false;
      running.current = false;
      stream.current?.getTracks().forEach((t) => t.stop());
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  return (
    <div className="space-y-2">
      <Button
        variant="outline"
        onClick={async () => {
          if (active) {
            stop();
            return;
          }
          const Constructor = (
            window as unknown as { BarcodeDetector?: new (o: object) => Detector }
          ).BarcodeDetector;
          if (!Constructor) {
            setMessage(
              "Este navegador no reconoce códigos por cámara. Usá un lector USB o escribí el código en la búsqueda.",
            );
            return;
          }
          try {
            const detector = new Constructor({
              formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128"],
            });
            stream.current = await navigator.mediaDevices.getUserMedia({
              video: { facingMode: "environment" },
            });
            if (!mounted.current) {
              stream.current?.getTracks().forEach((t) => t.stop());
              return;
            }
            setActive(true);
            running.current = true;
            const scan = async () => {
              if (!running.current) return;
              if (video.current) {
                if (video.current.srcObject !== stream.current) {
                  video.current.srcObject = stream.current;
                  await video.current.play();
                }
                const values =
                  video.current.readyState >= 2 ? await detector.detect(video.current) : [];
                if (values[0]) {
                  onRead(values[0].rawValue);
                  stop();
                  return;
                }
              }
              timer.current = setTimeout(
                () =>
                  void scan().catch(() => {
                    stop();
                    setMessage("No se pudo leer el código. Usá la búsqueda.");
                  }),
                250,
              );
            };
            await scan();
          } catch {
            stop();
            setMessage("No se pudo abrir la cámara. Usá el lector o la búsqueda.");
          }
        }}
      >
        {active ? "Cerrar cámara" : "Usar cámara para escanear"}
      </Button>
      <video ref={video} hidden={!active} className="max-h-64 w-full rounded" muted playsInline />
      <p role="status" className="text-sm">
        {message}
      </p>
    </div>
  );
}
function Picking() {
  const [page, setPage] = useState(0),
    [order, setOrder] = useState<string | null>(null);
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["admin", "picking", page],
    queryFn: async () => {
      const r = await supabase
        .from("orders")
        .select(
          "id,order_number,customer_name,delivery_method,delivery_street,delivery_number,delivery_city,pickup_branch,status",
        )
        .in("status", ["paid", "preparing"])
        .not("stock_committed_at", "is", null)
        .eq("needs_review", false)
        .order("created_at")
        .order("id")
        .range(page * 20, page * 20 + 19);
      if (r.error) throw r.error;
      return r.data;
    },
  });
  const details = useQuery({
    queryKey: ["admin", "picking-items", order],
    enabled: !!order,
    queryFn: async () => {
      const i = await supabase
        .from("order_items")
        .select("id,product_name,quantity")
        .eq("order_id", order!)
        .order("id");
      if (i.error) throw i.error;
      const c = i.data?.length
        ? await commerce
            .from("order_picking")
            .select("item_id,checked")
            .in(
              "item_id",
              i.data.map((x) => x.id),
            )
        : { data: [], error: null };
      if (c.error) throw c.error;
      return { items: i.data ?? [], checks: c.data ?? [] };
    },
  });
  const selected = q.data?.find((o) => o.id === order);
  return (
    <section className="space-y-4 rounded-xl border bg-card p-4">
      <h2 className="font-serif text-2xl">Preparar pedidos</h2>
      <p className="text-sm">
        Solo pedidos pagados con stock descontado y sin revisión pendiente. El listado conserva las
        cantidades de cada artículo.
      </p>
      {q.isError && <p role="alert">No se pudieron cargar los pedidos.</p>}
      <div className="flex flex-wrap gap-2">
        {q.data?.map((o) => (
          <Button
            key={o.id}
            variant={order === o.id ? "default" : "outline"}
            onClick={() => setOrder(o.id)}
          >
            #{o.order_number} · {o.customer_name}
          </Button>
        ))}
      </div>
      {!q.data?.length && !q.isPending && <p>No hay pedidos pendientes de preparación.</p>}
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={page === 0}
          onClick={() => {
            setPage(page - 1);
            setOrder(null);
          }}
        >
          Anterior
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={(q.data?.length ?? 0) < 20}
          onClick={() => {
            setPage(page + 1);
            setOrder(null);
          }}
        >
          Siguiente
        </Button>
      </div>
      {selected && details.data && (
        <>
          <h3 className="font-semibold">
            Pedido #{selected.order_number} · {selected.customer_name}
          </h3>
          <p className="text-sm">
            {selected.delivery_method === "pickup"
              ? `Retiro: ${selected.pickup_branch ?? ""}`
              : `Entrega: ${selected.delivery_street ?? ""} ${selected.delivery_number ?? ""}, ${selected.delivery_city ?? ""}`}
          </p>
          <ul>
            {details.data.items.map((i) => (
              <li key={i.id} className="my-3">
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={details.data.checks.some((c) => c.item_id === i.id && c.checked)}
                    onChange={async (e) => {
                      try {
                        await save("pick", { item_id: i.id, checked: e.target.checked });
                        await qc.invalidateQueries({ queryKey: ["admin", "picking-items", order] });
                      } catch (e) {
                        toast.error(err(e));
                      }
                    }}
                  />
                  {i.quantity} × {i.product_name}
                </label>
              </li>
            ))}
          </ul>
          <Button
            variant="outline"
            onClick={() => {
              const win = window.open("", "_blank", "width=800,height=700");
              if (!win) {
                toast.error("Permití ventanas emergentes para imprimir.");
                return;
              }
              win.document.title = `Pedido ${selected.order_number}`;
              const pre = win.document.createElement("pre");
              pre.style.whiteSpace = "pre-wrap";
              pre.textContent =
                `EL ARCÁNGEL · Pedido #${selected.order_number}\n${selected.customer_name}\n${selected.delivery_method === "pickup" ? `Retiro: ${selected.pickup_branch ?? ""}` : `Entrega: ${selected.delivery_street ?? ""} ${selected.delivery_number ?? ""}, ${selected.delivery_city ?? ""}`}\n\n` +
                details.data.items
                  .map(
                    (i) =>
                      `${details.data.checks.some((c) => c.item_id === i.id && c.checked) ? "[X]" : "[ ]"} ${i.quantity} x ${i.product_name}`,
                  )
                  .join("\n");
              win.document.body.append(pre);
              win.opener = null;
              win.print();
            }}
          >
            Imprimir hoja de preparación
          </Button>
        </>
      )}
    </section>
  );
}
function MarginReport() {
  const [from, setFrom] = useState(() => shiftDate(buenosAiresDate(), -29)),
    [to, setTo] = useState(() => buenosAiresDate());
  const error = validateSalesDates(from, to);
  const q = useQuery({
    queryKey: ["admin", "profit", from, to],
    enabled: !error,
    queryFn: async () => {
      const r = await commerce.rpc("admin_profit_report", { p_from: from, p_to: to });
      if (r.error) throw r.error;
      return r.data as unknown as {
        known_margin: number;
        unknown_cost_units: number;
        rows: {
          product_id: string;
          product_name: string;
          units: number;
          revenue: number;
          cost: number;
          margin: number;
        }[];
      };
    },
  });
  return (
    <section className="space-y-4 rounded-xl border bg-card p-4">
      <h2 className="font-serif text-2xl">Margen bruto de artículos</h2>
      <p className="text-sm">
        Ventas cobradas con stock confirmado y sin revisión pendiente, menos el costo registrado al
        generar cada pedido. Excluye envío, impuestos, comisiones, gastos y devoluciones; no es
        ganancia neta.
      </p>
      <div className="flex flex-wrap gap-3">
        <label className="text-sm">
          Desde
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="text-sm">
          Hasta
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
      </div>
      {error && <p role="alert">{error}</p>}
      {q.isError ? (
        <p role="alert">No se pudo calcular el margen.</p>
      ) : (
        q.data && (
          <>
            <p className="text-xl">Margen con costo conocido: {formatARS(q.data.known_margin)}</p>
            <p className="text-sm">
              Unidades sin costo histórico: {q.data.unknown_cost_units}. No se incluyen en el
              margen.
            </p>
            <div className="overflow-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr>
                    <th>Artículo</th>
                    <th>Unidades</th>
                    <th>Venta ARS</th>
                    <th>Costo ARS</th>
                    <th>Margen ARS</th>
                  </tr>
                </thead>
                <tbody>
                  {q.data.rows.map((r, i) => (
                    <tr key={`${r.product_id}-${i}`} className="border-t">
                      <td className="py-2">{r.product_name}</td>
                      <td>{r.units}</td>
                      <td>{formatARS(r.revenue)}</td>
                      <td>{formatARS(r.cost)}</td>
                      <td>{formatARS(r.margin)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )
      )}
    </section>
  );
}
function Notices() {
  const q = useQuery({
    queryKey: ["admin", "stock-notices"],
    queryFn: async () => {
      const r = await commerce
        .from("stock_notifications")
        .select("id", { count: "exact", head: true });
      if (r.error) throw r.error;
      return r;
    },
  });
  return (
    <section className="space-y-3 rounded-xl border bg-card p-4">
      <h2 className="font-serif text-2xl">Avisos de reposición</h2>
      <p className="text-sm">
        Los clientes pueden solicitar y cancelar un aviso desde los artículos agotados. Se usa el
        email confirmado de su cuenta.
      </p>
      <p>Solicitudes registradas: {q.data?.count ?? "…"}</p>
      <p className="text-sm text-muted-foreground">
        El envío automático queda desactivado hasta verificar el dominio de correo y configurar
        Resend. No se envían emails de prueba a clientes.
      </p>
      {q.isError && <p role="alert">No se pudieron consultar las solicitudes.</p>}
    </section>
  );
}
