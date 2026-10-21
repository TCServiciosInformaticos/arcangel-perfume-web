import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { CheckoutSchema } from "@/lib/checkout-validation";
export type { CheckoutInput } from "@/lib/checkout-validation";
export const createCheckout = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        checkout: CheckoutSchema,
        requestKey: z.string().uuid(),
        accessToken: z.string().min(20).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    if (
      !process.env.SUPABASE_URL ||
      !process.env.SUPABASE_SERVICE_ROLE_KEY ||
      !process.env.MERCADOPAGO_ACCESS_TOKEN ||
      !process.env.MERCADOPAGO_WEBHOOK_SECRET ||
      !process.env.ORDER_ACCESS_SECRET
    )
      throw new Error(
        "El pago todavía no está habilitado. Tu carrito sigue guardado mientras la tienda termina de configurarlo.",
      );
    const { startOrderCheckout } = await import("./order-checkout.server");
    const { verifiedShopper } = await import("./commerce.server");
    const user = await verifiedShopper(data.accessToken);
    return startOrderCheckout(data.checkout, undefined, data.requestKey, user?.id, user?.email);
  });
export const resumeOrderCheckout = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({ orderId: z.string().uuid(), token: z.string().regex(/^[a-f0-9]{64}$/i) })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { verifyOrderAccess } = await import("./payment-security.server");
    if (
      !process.env.ORDER_ACCESS_SECRET ||
      !verifyOrderAccess(data.orderId, data.token, process.env.ORDER_ACCESS_SECRET)
    )
      throw new Error("El enlace de este pedido no es válido.");
    const { reconcileOrder } = await import("./payment-sync.server");
    // Never offer a new payment without first checking previous attempts.
    await reconcileOrder(data.orderId);
    const { startOrderCheckout } = await import("./order-checkout.server");
    return startOrderCheckout(null, data.orderId);
  });

export const verifyOrderPayment = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({ orderId: z.string().uuid(), token: z.string().regex(/^[a-f0-9]{64}$/i) })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { verifyOrderAccess } = await import("./payment-security.server");
    if (
      !process.env.ORDER_ACCESS_SECRET ||
      !verifyOrderAccess(data.orderId, data.token, process.env.ORDER_ACCESS_SECRET)
    )
      throw new Error("El enlace de este pedido no es válido.");
    const { reconcileOrder } = await import("./payment-sync.server");
    await reconcileOrder(data.orderId);
    return true;
  });
