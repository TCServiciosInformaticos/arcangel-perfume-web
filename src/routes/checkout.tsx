import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCart } from "@/lib/cart-context";
import { formatARS } from "@/lib/format";
import { createCheckout } from "@/lib/checkout.functions";

const settingsQuery = queryOptions({
  queryKey: ["settings", "public"],
  queryFn: async () => {
    const { data } = await supabase.from("settings").select("shipping_cost, shipping_zones, pickup_address, store_name").eq("id", 1).maybeSingle();
    return data;
  },
});

export const Route = createFileRoute("/checkout")({
  head: () => ({ meta: [{ title: "Checkout — Perfumería El Arcángel" }, { name: "robots", content: "noindex" }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(settingsQuery),
  component: CheckoutPage,
});

const FormSchema = z.object({
  customer_name: z.string().trim().min(2, "Ingresá tu nombre completo").max(120),
  customer_email: z.string().trim().email("Email inválido"),
  customer_whatsapp: z.string().trim().min(6, "WhatsApp inválido").max(30),
  delivery_method: z.enum(["pickup", "shipping"]),
  delivery_street: z.string().trim().max(160).optional(),
  delivery_number: z.string().trim().max(20).optional(),
  delivery_apartment: z.string().trim().max(40).optional(),
  delivery_city: z.string().trim().max(80).optional(),
  delivery_zip: z.string().trim().max(20).optional(),
  delivery_day: z.string().trim().max(40).optional(),
  delivery_time_slot: z.enum(["morning", "afternoon", "evening"]).optional(),
  notes: z.string().trim().max(500).optional(),
});

function CheckoutPage() {
  const { items, subtotal } = useCart();
  const { data: settings } = useSuspenseQuery(settingsQuery);
  const checkout = useServerFn(createCheckout);
  const [method, setMethod] = useState<"pickup" | "shipping">("shipping");
  const [submitting, setSubmitting] = useState(false);
  const [timeSlot, setTimeSlot] = useState<"morning" | "afternoon" | "evening" | "">("");

  const shippingCost = method === "shipping" ? Number(settings?.shipping_cost ?? 0) : 0;
  const total = subtotal + shippingCost;

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (items.length === 0) return;
    const fd = new FormData(e.currentTarget);
    const raw = {
      customer_name: String(fd.get("customer_name") ?? ""),
      customer_email: String(fd.get("customer_email") ?? ""),
      customer_whatsapp: String(fd.get("customer_whatsapp") ?? ""),
      delivery_method: method,
      delivery_street: String(fd.get("delivery_street") ?? ""),
      delivery_number: String(fd.get("delivery_number") ?? ""),
      delivery_apartment: String(fd.get("delivery_apartment") ?? ""),
      delivery_city: String(fd.get("delivery_city") ?? ""),
      delivery_zip: String(fd.get("delivery_zip") ?? ""),
      delivery_day: String(fd.get("delivery_day") ?? ""),
      delivery_time_slot: (timeSlot || undefined) as "morning" | "afternoon" | "evening" | undefined,
      notes: String(fd.get("notes") ?? ""),
    };
    const parsed = FormSchema.safeParse(raw);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Revisá el formulario");
      return;
    }
    if (method === "shipping" && (!parsed.data.delivery_street || !parsed.data.delivery_number || !parsed.data.delivery_city)) {
      toast.error("Completá la dirección de envío");
      return;
    }

    setSubmitting(true);
    try {
      const res = await checkout({
        data: {
          ...parsed.data,
          items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
        },
      });
      window.sessionStorage.setItem("arcangel-pending-order", JSON.stringify({ orderId: res.orderId }));
      window.location.assign(res.init_point);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo iniciar el pago");
      setSubmitting(false);
    }
  }

  if (items.length === 0) {
    return (
      <div className="flex min-h-screen flex-col">
        <SiteHeader />
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-16 text-center">
          <h1 className="font-serif text-3xl">No hay productos en tu carrito</h1>
          <Link to="/productos" className="mt-6 inline-block text-primary underline">Volver al catálogo</Link>
        </main>
        <SiteFooter />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6 lg:px-8">
        <h1 className="font-serif text-4xl sm:text-5xl">Checkout</h1>

        <form onSubmit={onSubmit} className="mt-8 grid gap-8 lg:grid-cols-[1fr_360px]">
          <div className="space-y-8">
            <section className="rounded-lg border border-border bg-card p-6">
              <h2 className="font-serif text-2xl">Tus datos</h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <Field label="Nombre y apellido" name="customer_name" required autoComplete="name" />
                <Field label="Email" name="customer_email" type="email" required autoComplete="email" />
                <Field label="WhatsApp" name="customer_whatsapp" required placeholder="+54 9 11 ..." autoComplete="tel" />
              </div>
            </section>

            <section className="rounded-lg border border-border bg-card p-6">
              <h2 className="font-serif text-2xl">Entrega</h2>
              <RadioGroup value={method} onValueChange={(v) => setMethod(v as "pickup" | "shipping")} className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className={`flex cursor-pointer items-start gap-3 rounded-md border p-4 ${method === "shipping" ? "border-primary bg-primary/5" : "border-border"}`}>
                  <RadioGroupItem value="shipping" />
                  <div>
                    <div className="font-medium">Envío a domicilio</div>
                    <div className="text-xs text-muted-foreground">{settings?.shipping_zones ?? "CABA y alrededores"}{shippingCost > 0 ? ` · ${formatARS(shippingCost)}` : ""}</div>
                  </div>
                </label>
                <label className={`flex cursor-pointer items-start gap-3 rounded-md border p-4 ${method === "pickup" ? "border-primary bg-primary/5" : "border-border"}`}>
                  <RadioGroupItem value="pickup" />
                  <div>
                    <div className="font-medium">Retiro en el local</div>
                    <div className="text-xs text-muted-foreground">{settings?.pickup_address ?? "Coordinamos por WhatsApp"}</div>
                  </div>
                </label>
              </RadioGroup>

              {method === "shipping" && (
                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  <Field label="Calle" name="delivery_street" required autoComplete="address-line1" />
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Número" name="delivery_number" required />
                    <Field label="Piso / Depto" name="delivery_apartment" />
                  </div>
                  <Field label="Localidad" name="delivery_city" required autoComplete="address-level2" />
                  <Field label="Código postal" name="delivery_zip" autoComplete="postal-code" />
                  <Field label="Día preferido" name="delivery_day" placeholder="Ej: martes 28" />
                  <div className="flex flex-col gap-1.5">
                    <Label>Franja horaria</Label>
                    <Select value={timeSlot} onValueChange={(v) => setTimeSlot(v as typeof timeSlot)}>
                      <SelectTrigger><SelectValue placeholder="Elegir franja" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="morning">Mañana (9–13 h)</SelectItem>
                        <SelectItem value="afternoon">Tarde (13–18 h)</SelectItem>
                        <SelectItem value="evening">Noche (18–21 h)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              <div className="mt-4">
                <Label htmlFor="notes">Notas (opcional)</Label>
                <Textarea id="notes" name="notes" placeholder="Timbre, referencias, regalo…" className="mt-1.5" />
              </div>
            </section>
          </div>

          <aside className="h-fit space-y-4 rounded-lg border border-border bg-card p-6">
            <h2 className="font-serif text-2xl">Tu pedido</h2>
            <ul className="divide-y divide-border text-sm">
              {items.map((it) => (
                <li key={it.productId} className="flex justify-between py-2">
                  <span className="pr-2">{it.quantity}× {it.name}</span>
                  <span className="font-medium">{formatARS(it.price * it.quantity)}</span>
                </li>
              ))}
            </ul>
            <dl className="space-y-1.5 text-sm">
              <div className="flex justify-between"><dt className="text-muted-foreground">Subtotal</dt><dd>{formatARS(subtotal)}</dd></div>
              {method === "shipping" && (
                <div className="flex justify-between"><dt className="text-muted-foreground">Envío</dt><dd>{shippingCost > 0 ? formatARS(shippingCost) : "Gratis"}</dd></div>
              )}
            </dl>
            <div className="flex items-center justify-between border-t border-border pt-3">
              <span className="font-medium">Total</span>
              <span className="font-serif text-2xl text-primary">{formatARS(total)}</span>
            </div>
            <Button type="submit" size="lg" className="w-full" disabled={submitting}>
              {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Iniciando pago…</> : "Pagar con MercadoPago"}
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              Después del pago aprobado, podrás abrir WhatsApp y enviar tu pedido completo al dueño.
            </p>
          </aside>
        </form>
      </main>
      <SiteFooter />
    </div>
  );
}

function Field({ label, name, type = "text", required, placeholder, autoComplete }: { label: string; name: string; type?: string; required?: boolean; placeholder?: string; autoComplete?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={name}>{label}{required && <span className="text-destructive"> *</span>}</Label>
      <Input id={name} name={name} type={type} required={required} placeholder={placeholder} autoComplete={autoComplete} />
    </div>
  );
}
