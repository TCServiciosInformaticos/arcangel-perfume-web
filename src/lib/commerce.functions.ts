import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
const cart = z.object({
  items: z
    .array(z.object({ productId: z.string().uuid(), quantity: z.number().int().min(1).max(50) }))
    .min(1)
    .max(50),
  coupon_code: z.string().trim().max(30).optional(),
  accessToken: z.string().min(20).optional(),
});
export const previewCommerceCart = createServerFn({ method: "POST" })
  .validator((d: unknown) => cart.parse(d))
  .handler(async ({ data }) => {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY)
      throw new Error(
        "La tienda todavía debe habilitar la validación de cupones. Podés consultar precios sin cupón.",
      );
    const { quoteCart } = await import("./commerce.server");
    return quoteCart(data);
  });
export const repeatPurchase = createServerFn({ method: "POST" })
  .validator((d: unknown) =>
    z.object({ orderId: z.string().uuid(), token: z.string().regex(/^[a-f0-9]{64}$/i) }).parse(d),
  )
  .handler(async ({ data }) => {
    const { loadRepeatPurchase } = await import("./commerce.server");
    return loadRepeatPurchase(data);
  });
