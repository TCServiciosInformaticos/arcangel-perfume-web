import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
export const manageOrder = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        accessToken: z.string().min(20),
        orderId: z.string().uuid(),
        action: z.enum(["reconcile", "recovery_link"]),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: auth, error } = await supabaseAdmin.auth.getUser(data.accessToken);
    if (error || !auth.user) throw new Error("Sesión inválida.");
    const role = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", auth.user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (role.error || !role.data) throw new Error("Solo administradores.");
    const order = await supabaseAdmin.from("orders").select("id").eq("id", data.orderId).single();
    if (order.error) throw new Error("Pedido no encontrado.");
    if (data.action === "reconcile") {
      const { reconcileOrder } = await import("./payment-sync.server");
      await reconcileOrder(data.orderId);
      return { url: null };
    }
    const secret = process.env.ORDER_ACCESS_SECRET;
    if (!secret) throw new Error("No está configurado el acceso a pedidos.");
    const { signOrderAccess } = await import("./payment-security.server");
    const origin = new URL(
      process.env.PUBLIC_SITE_URL || "https://arcangel-perfume-web.lovable.app",
    ).origin;
    return {
      url: `${origin}/pago-pendiente?order=${data.orderId}&token=${signOrderAccess(data.orderId, secret)}`,
    };
  });
