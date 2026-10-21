export function escapeEmailHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}
export function buildRecoveryEmail(input: {
  name: string;
  orderNumber: number;
  recoveryUrl: string;
  storeName: string;
}) {
  const url = new URL(input.recoveryUrl);
  if (url.protocol !== "https:" || url.username || url.password)
    throw new Error("El enlace de recuperación debe usar HTTPS.");
  const name = escapeEmailHtml(input.name),
    store = escapeEmailHtml(input.storeName),
    href = escapeEmailHtml(url.href);
  const subject = `Podés retomar tu pedido #${input.orderNumber} en ${input.storeName}`;
  const text = `Hola ${input.name},\n\nTu pedido #${input.orderNumber} en ${input.storeName} quedó sin pago registrado. Podés retomarlo desde este enlace:\n${url.href}\n\nAl retomarlo, verificaremos los precios y la disponibilidad actuales. Si no registramos el pago durante las próximas 24 horas, el pedido quedará marcado como abandonado definitivo.\n\nSi ya pagaste, podés consultar el estado desde el mismo enlace.\n\n${input.storeName}`;
  const html = `<!doctype html><html lang="es"><body style="margin:0;background:#f7f4f6;font-family:Arial,sans-serif;color:#252025"><main style="max-width:560px;margin:24px auto;padding:32px;background:white;border-radius:12px"><p style="color:#b21568;font-size:20px;font-weight:bold">${store}</p><h1 style="font-size:25px">Tu pedido te está esperando</h1><p>Hola ${name},</p><p>Tu pedido <strong>#${input.orderNumber}</strong> quedó sin pago registrado. Podés retomarlo desde acá:</p><p style="margin:28px 0"><a href="${href}" style="display:inline-block;padding:15px 24px;border-radius:8px;background:#b21568;color:#fff;text-decoration:none;font-weight:bold">Retomar mi pedido</a></p><p>Al retomarlo, verificaremos los precios y la disponibilidad actuales.</p><p>Si no registramos el pago durante las próximas <strong>24 horas</strong>, el pedido quedará marcado como abandonado definitivo.</p><p style="font-size:13px;color:#615963">Si ya pagaste, podés consultar el estado desde el mismo enlace. Este es el único recordatorio de este pedido.</p><p style="font-size:12px;color:#615963">Si el botón no funciona, copiá este enlace en tu navegador:<br><a href="${href}" style="word-break:break-all">${href}</a></p></main></body></html>`;
  return { subject, html, text };
}
