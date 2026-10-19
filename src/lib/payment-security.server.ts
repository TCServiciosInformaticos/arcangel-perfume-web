import { createHmac, timingSafeEqual } from "node:crypto";

function equalHex(left: string, right: string): boolean {
  if (!/^[a-f0-9]{64}$/i.test(left) || !/^[a-f0-9]{64}$/i.test(right)) return false;
  return timingSafeEqual(Buffer.from(left, "hex"), Buffer.from(right, "hex"));
}

export function signOrderAccess(orderId: string, secret: string): string {
  return createHmac("sha256", secret).update(`order:${orderId}`).digest("hex");
}

export function verifyOrderAccess(orderId: string, token: string, secret: string): boolean {
  return equalHex(token, signOrderAccess(orderId, secret));
}

export function verifyMercadoPagoSignature(signature: string | null, requestId: string | null, paymentId: string, secret: string): boolean {
  if (!signature || !requestId) return false;
  const parts = Object.fromEntries(signature.split(",").map((part) => part.trim().split("=")));
  if (!parts.ts || !/^\d+$/.test(parts.ts) || !parts.v1) return false;
  const manifest = `id:${paymentId.toLowerCase()};request-id:${requestId};ts:${parts.ts};`;
  const expected = createHmac("sha256", secret).update(manifest).digest("hex");
  return equalHex(parts.v1, expected);
}