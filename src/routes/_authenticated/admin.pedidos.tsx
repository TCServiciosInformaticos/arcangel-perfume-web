import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { manageOrder } from "@/lib/order-admin.functions";
import {
  canResumeOrder,
  orderStatusLabels,
  orderEventLabels,
  attemptStateLabels,
} from "@/lib/order-lifecycle";
import { formatARS } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
export const Route = createFileRoute("/_authenticated/admin/pedidos")({ component: OrdersPage });
const date = (s: string) => new Date(s).toLocaleString("es-AR");
function OrdersPage() {
  const { session, isAdmin } = useAuth(),
    qc = useQueryClient(),
    manage = useServerFn(manageOrder);
  const [term, setTerm] = useState(""),
    [status, setStatus] = useState(""),
    [age, setAge] = useState(""),
    [archived, setArchived] = useState(false),
    [page, setPage] = useState(0),
    [selected, setSelected] = useState<string | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const recoveryStatus = useQuery({
    queryKey: ["admin", "order-recovery-status"],
    queryFn: async () => {
      const r = await fetch("/api/public/order-recovery-emails");
      if (!r.ok) throw new Error("No se pudo consultar el servicio de correo.");
      return (await r.json()) as { ready: boolean };
    },
    retry: false,
  });
  const list = useQuery({
    queryKey: ["admin", "orders", term, status, age, archived, page],
    queryFn: async () => {
      let q = supabase
        .from("orders")
        .select(
          "id,order_number,customer_name,customer_email,customer_whatsapp,status,total,created_at,abandon_at,reservation_until,needs_review,review_reason,archived_at,delivery_method,stock_committed_at,last_reconciled_at,recovery_due_at,recovery_sent_at",
          { count: "exact" },
        )
        .order("created_at", { ascending: false })
        .order("id")
        .range(page * 25, page * 25 + 24);
      if (status) q = q.eq("status", status as "pending_payment");
      if (archived) q = q.not("archived_at", "is", null);
      else q = q.is("archived_at", null);
      if (age) q = q.lte("created_at", new Date(Date.now() - Number(age) * 3600000).toISOString());
      const t = term
        .replace(/[^\p{L}\p{N}@ ._-]/gu, "")
        .trim()
        .slice(0, 100);
      if (t) {
        if (/^\d+$/.test(t)) q = q.eq("order_number", Number(t));
        else q = q.or(`customer_name.ilike."%${t}%",customer_email.ilike."%${t}%"`);
      }
      const r = await q;
      if (r.error) throw r.error;
      return { rows: r.data, total: r.count ?? 0 };
    },
  });
  const details = useQuery({
    queryKey: ["admin", "order", selected],
    enabled: !!selected,
    queryFn: async () => {
      const [o, i, e, a, mail] = await Promise.all([
        supabase.from("orders").select("*").eq("id", selected!).single(),
        supabase.from("order_items").select("*").eq("order_id", selected!),
        supabase
          .from("order_events")
          .select("*")
          .eq("order_id", selected!)
          .order("created_at", { ascending: false }),
        supabase
          .from("order_payment_attempts")
          .select("id,state,total,expires_at,created_at,payment_id")
          .eq("order_id", selected!)
          .order("created_at", { ascending: false }),
        supabase
          .from("order_recovery_emails")
          .select("state,attempts,sent_at,next_attempt_at,last_error")
          .eq("order_id", selected!)
          .maybeSingle(),
      ]);
      for (const r of [o, i, e, a, mail]) if (r.error) throw r.error;
      return {
        order: o.data!,
        items: i.data ?? [],
        events: e.data ?? [],
        attempts: a.data ?? [],
        email: mail.data,
      };
    },
  });
  async function act(id: string, action: string) {
    if (
      action === "cancel" &&
      !window.confirm(
        "¿Cancelar este pedido? Se libera la reserva. Un cobro posterior se registrará para revisión.",
      )
    )
      return;
    let note: string | undefined;
    if (action === "resolve_review") {
      note =
        window.prompt("Indicá cómo resolviste el caso (entrega, pago duplicado o devolución):") ??
        undefined;
      if (!note?.trim()) return;
    }
    if (
      action === "resolve_stock" &&
      !window.confirm("Se verificará y descontará el stock del pedido pagado. ¿Continuar?")
    )
      return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (action === "reconcile" || action === "recovery_link") {
        if (!session?.access_token) throw new Error("Ingresá nuevamente al admin.");
        const result = await manage({
          data: { accessToken: session.access_token, orderId: id, action },
        });
        if (result.url) {
          await navigator.clipboard.writeText(result.url);
          setMessage(
            "Enlace copiado. Permite acceder a los datos y retomar este pedido; compartilo únicamente con su cliente.",
          );
        } else setMessage("Estado consultado en Mercado Pago.");
      } else {
        const r = await supabase.rpc("admin_order_action", {
          oid: id,
          action,
          note: note ?? undefined,
        });
        if (r.error) throw r.error;
        setMessage("Pedido actualizado.");
      }
      await qc.invalidateQueries({ queryKey: ["admin", "orders"] });
      await qc.invalidateQueries({ queryKey: ["admin", "order"] });
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : typeof e === "object" && e && "message" in e
            ? String(e.message)
            : "No se pudo completar la operación.",
      );
    } finally {
      setBusy(false);
    }
  }
  const o = details.data?.order;
  return (
    <div>
      <h1 className="text-3xl font-semibold">Pedidos</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Reservas de 30 minutos. Después de 1 hora sin pagar se prepara un email. El abandono
        definitivo ocurre 24 horas después de que el servicio de correo acepte el aviso. El
        historial se conserva; archivar no elimina datos personales.
      </p>
      {!recoveryStatus.data?.ready && !recoveryStatus.isLoading && (
        <p className="mt-3 rounded border p-3 text-sm">
          El email automático está pendiente de configuración o activación. Los avisos no se
          enviarán hasta que el servicio esté listo. Los carritos sin un pedido con email registrado
          no pueden recibir recordatorios.
        </p>
      )}
      <div className="my-5 flex flex-wrap gap-3">
        <Input
          aria-label="Buscar pedido"
          className="max-w-xs"
          placeholder="N° de pedido, nombre o email"
          value={term}
          onChange={(e) => {
            setTerm(e.target.value);
            setPage(0);
          }}
        />
        <select
          aria-label="Estado del pedido"
          className="rounded border bg-background p-2"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(0);
          }}
        >
          <option value="">Todos los estados</option>
          {Object.entries(orderStatusLabels).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
        <select
          aria-label="Antigüedad del pedido"
          className="rounded border bg-background p-2"
          value={age}
          onChange={(e) => {
            setAge(e.target.value);
            setPage(0);
          }}
        >
          <option value="">Cualquier antigüedad</option>
          <option value="24">Más de 24 horas</option>
          <option value="168">Más de 7 días</option>
          <option value="720">Más de 30 días</option>
        </select>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={archived}
            onChange={(e) => {
              setArchived(e.target.checked);
              setPage(0);
            }}
          />
          Archivados
        </label>
        <Button variant="outline" onClick={() => list.refetch()}>
          Actualizar
        </Button>
      </div>
      {error && (
        <p role="alert" className="mb-3 text-destructive">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="mb-3 text-primary">
          {message}
        </p>
      )}
      {list.error && <p role="alert">No se pudieron cargar los pedidos.</p>}
      <div className="overflow-auto rounded border">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="bg-secondary">
              <th className="p-3">Pedido / fecha</th>
              <th>Cliente</th>
              <th>Estado</th>
              <th>Total</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {list.data?.rows.map((p) => (
              <tr key={p.id} className="border-t">
                <td className="p-3">
                  #{p.order_number}
                  <div className="text-xs text-muted-foreground">{date(p.created_at)}</div>
                </td>
                <td>
                  {p.customer_name}
                  <div className="text-xs">{p.customer_email}</div>
                </td>
                <td>
                  {orderStatusLabels[p.status]}
                  {p.needs_review && (
                    <div className="font-semibold text-destructive">Requiere revisión</div>
                  )}
                </td>
                <td>{formatARS(p.total)}</td>
                <td>
                  <Button size="sm" variant="outline" onClick={() => setSelected(p.id)}>
                    Ver detalle
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {list.isLoading ? (
        <p>Cargando…</p>
      ) : (
        !list.data?.total && <p className="mt-4">No hay pedidos para estos filtros.</p>
      )}
      <div className="my-4 flex items-center gap-3">
        <Button disabled={page === 0} variant="outline" onClick={() => setPage((p) => p - 1)}>
          Anterior
        </Button>
        <span>
          {list.data?.total ?? 0} pedidos · Página {page + 1}
        </span>
        <Button
          disabled={(page + 1) * 25 >= (list.data?.total ?? 0)}
          variant="outline"
          onClick={() => setPage((p) => p + 1)}
        >
          Siguiente
        </Button>
      </div>
      {selected && (
        <section className="mt-6 rounded border bg-card p-5">
          <Button variant="outline" onClick={() => setSelected(null)}>
            Cerrar detalle
          </Button>
          {details.isLoading ? (
            <p>Cargando…</p>
          ) : details.error ? (
            <p role="alert">No se pudo cargar el detalle.</p>
          ) : (
            o && (
              <>
                <h2 className="mt-4 text-xl font-semibold">
                  Pedido #{o.order_number} · {orderStatusLabels[o.status]}
                </h2>
                <p className="mt-2">
                  {o.customer_name} · {o.customer_email} · {o.customer_whatsapp}
                </p>
                <p>
                  {o.delivery_method === "pickup"
                    ? `Retiro: ${o.pickup_branch ?? ""}`
                    : `Envío: ${[o.delivery_street, o.delivery_number, o.delivery_apartment, o.delivery_city, o.delivery_zip].filter(Boolean).join(" ")}`}
                </p>
                {o.notes && <p>Notas: {o.notes}</p>}
                {o.needs_review && (
                  <p className="my-3 rounded bg-destructive/10 p-3 text-destructive">
                    {o.review_reason}
                  </p>
                )}
                <ul className="my-4">
                  {details.data?.items.map((i) => (
                    <li key={i.id}>
                      {i.quantity} × {i.product_name} · {formatARS(i.unit_price)} c/u
                    </li>
                  ))}
                </ul>
                <p>
                  Total: {formatARS(o.total)} · Stock descontado:{" "}
                  {o.stock_committed_at ? date(o.stock_committed_at) : "No"}
                </p>
                <p className="text-sm">
                  Última conciliación:{" "}
                  {o.last_reconciled_at ? date(o.last_reconciled_at) : "Sin consultar"} · Reserva:{" "}
                  {o.reservation_until && new Date(o.reservation_until) > new Date()
                    ? `hasta ${date(o.reservation_until)}`
                    : "Sin reserva vigente"}
                </p>
                <div className="my-4 flex flex-wrap gap-2">
                  {isAdmin && (
                    <Button disabled={busy} onClick={() => act(o.id, "reconcile")}>
                      Consultar Mercado Pago
                    </Button>
                  )}
                  {canResumeOrder(o.status) && (
                    <>
                      {isAdmin && (
                        <Button
                          disabled={busy}
                          variant="outline"
                          onClick={() => act(o.id, "recovery_link")}
                        >
                          Copiar enlace para retomar
                        </Button>
                      )}
                      <Button disabled={busy} variant="outline" onClick={() => act(o.id, "cancel")}>
                        Cancelar pedido
                      </Button>
                    </>
                  )}
                  {o.status === "paid" && !o.needs_review && (
                    <Button disabled={busy} onClick={() => act(o.id, "preparing")}>
                      Preparar
                    </Button>
                  )}
                  {o.status === "preparing" && (
                    <>
                      <Button disabled={busy} onClick={() => act(o.id, "shipped")}>
                        Marcar enviado
                      </Button>
                      <Button disabled={busy} onClick={() => act(o.id, "delivered")}>
                        Marcar entregado
                      </Button>
                    </>
                  )}
                  {o.status === "shipped" && (
                    <Button disabled={busy} onClick={() => act(o.id, "delivered")}>
                      Marcar entregado
                    </Button>
                  )}
                  {isAdmin && o.needs_review && o.status === "paid" && (
                    <Button
                      disabled={busy}
                      variant="outline"
                      onClick={() =>
                        act(o.id, o.stock_committed_at ? "resolve_review" : "resolve_stock")
                      }
                    >
                      {o.stock_committed_at
                        ? "Registrar resolución"
                        : "Verificar y descontar stock"}
                    </Button>
                  )}
                  {[
                    "abandoned",
                    "abandoned_final",
                    "cancelled",
                    "payment_rejected",
                    "delivered",
                  ].includes(o.status) && (
                    <Button
                      disabled={busy}
                      variant="outline"
                      onClick={() => act(o.id, o.archived_at ? "unarchive" : "archive")}
                    >
                      {o.archived_at ? "Desarchivar" : "Archivar"}
                    </Button>
                  )}
                </div>
                <section className="my-4 rounded border p-3">
                  <h3 className="font-semibold">Recordatorio por email</h3>
                  <p className="text-sm">
                    {o.recovery_sent_at
                      ? `Aceptado por el servicio de correo: ${date(o.recovery_sent_at)}. Plazo final: ${date(o.abandon_at)}.`
                      : details.data?.email?.state === "failed" ||
                          details.data?.email?.state === "review"
                        ? "Requiere revisión: el aviso no tiene envío confirmado."
                        : details.data?.email?.state === "sending"
                          ? "Envío en curso."
                          : details.data?.email?.state === "cancelled"
                            ? "Aviso cancelado."
                            : `A partir de ${date(o.recovery_due_at)}, si el pedido continúa sin pagar.`}
                  </p>
                  {details.data?.email?.last_error && (
                    <p className="text-sm text-destructive">{details.data.email.last_error}</p>
                  )}
                  <p className="mt-1 text-xs text-muted-foreground">
                    La aceptación del proveedor no confirma que el cliente haya leído el email. Si
                    el envío falla, el plazo de 24 horas todavía no comienza.
                  </p>
                </section>
                <h3 className="font-semibold">Intentos de pago</h3>
                <ul className="mb-4 text-sm">
                  {details.data?.attempts.map((a) => (
                    <li key={a.id}>
                      {date(a.created_at)} · {attemptStateLabels[a.state] ?? a.state} ·{" "}
                      {formatARS(a.total)}
                      {a.payment_id ? ` · Pago ${a.payment_id}` : ""}
                    </li>
                  ))}
                </ul>
                <h3 className="font-semibold">Historial</h3>
                <ul className="text-sm">
                  {details.data?.events.map((e) => (
                    <li key={e.id} className="my-2">
                      {date(e.created_at)} ·{" "}
                      {orderEventLabels[e.kind] ?? "Actualización del pedido"}
                      <div className="text-xs text-muted-foreground">
                        {typeof e.detail === "object" && e.detail && !Array.isArray(e.detail) && (
                          <>
                            {e.detail.payment_id && (
                              <span>Pago: {String(e.detail.payment_id)}. </span>
                            )}
                            {typeof e.detail.total === "number" && (
                              <span>Total: {formatARS(e.detail.total)}. </span>
                            )}
                            {e.detail.note && <span>{String(e.detail.note)}</span>}
                          </>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            )
          )}
        </section>
      )}
    </div>
  );
}
