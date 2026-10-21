import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { CheckoutSchema } from "@/lib/checkout-validation";
export type { CheckoutInput } from "@/lib/checkout-validation";
export const createCheckout = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ checkout: CheckoutSchema, requestKey: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data }) => {
    const { startOrderCheckout } = await import("./order-checkout.server");
    return startOrderCheckout(data.checkout, undefined, data.requestKey);
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
