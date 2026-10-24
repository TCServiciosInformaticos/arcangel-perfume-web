// Remove these hosts from the set when the storefront is ready to launch.
const comingSoonHosts = new Set([
  "perfumeriaelarcangel.com.ar",
  "www.perfumeriaelarcangel.com.ar",
]);

export function comingSoonResponse(request: Request): Response | null {
  const url = new URL(request.url);
  if (!comingSoonHosts.has(url.hostname.toLowerCase())) return null;
  if (request.method !== "GET" && request.method !== "HEAD") return null;
  // Keep staff sign-in, integrations and existing payment receipts available.
  const path = url.pathname;
  if (/^\/(admin|auth|api|mcp|gracias|pago-pendiente|pago-fallido)(\/|$)/.test(path)
    || path.startsWith("/.") || path.startsWith("/_")
    || /\.[a-z0-9]+$/i.test(path)) return null;
  return new Response(request.method === "HEAD" ? null : comingSoonHtml, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "x-robots-tag": "noindex, nofollow",
    },
  });
}

const comingSoonHtml = `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Próximamente · Perfumería El Arcángel</title>
<meta name="description" content="Estamos preparando nuestra tienda online. Muy pronto vas a poder comprar tus productos favoritos en Perfumería El Arcángel.">
<meta name="robots" content="noindex,nofollow"><meta name="theme-color" content="#ce0874">
<style>
*{box-sizing:border-box}body{margin:0;min-height:100svh;display:grid;place-items:center;background:#fcf7fa;color:#291526;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;padding:32px 20px}
body:before{content:"";position:fixed;inset:0 0 auto;height:7px;background:#ce0874}
main{text-align:center;width:100%;max-width:700px;padding:56px 32px;background:#fff;border:1px solid #efdeea;border-radius:28px;box-shadow:0 24px 80px #6d17420a}
img{display:block;width:min(280px,85%);height:auto;margin:0 auto 42px}.label{display:inline-block;margin:0 0 20px;padding:8px 16px;border-radius:30px;background:#fce9f3;color:#a8005d;font-size:12px;font-weight:700;letter-spacing:.13em;text-transform:uppercase}
h1{font-size:clamp(38px,8vw,64px);line-height:1.1;letter-spacing:-.045em;margin:0 0 24px;font-weight:750}h1 span{color:#ce0874}
p{max-width:480px;margin:0 auto;color:#735c6e;font-size:18px;line-height:1.7}.closing{margin-top:38px;padding-top:26px;border-top:1px solid #f1e5ed;font-size:14px;color:#806b7b}
@media(max-width:480px){main{padding:40px 22px}img{margin-bottom:32px}p{font-size:16px}}
</style></head><body><main><img src="/arcangel-logo.png" alt="Perfumería El Arcángel" width="280">
<div class="label">Nuestra tienda online</div><h1>Muy pronto,<br><span>más cerca tuyo.</span></h1>
<p>Estamos preparando un nuevo espacio para que encuentres tus productos favoritos de perfumería, belleza y cuidado personal.</p>
<p class="closing">Próximamente en Perfumería El Arcángel.<br>¡Gracias por acompañarnos!</p>
</main></body></html>`;
