// Send technical locations only; never include customer/order payloads or URLs with capabilities.
import type { Event, ErrorEvent as SentryErrorEvent } from "@sentry/browser";
const fixedRoutes = new Set([
  "/",
  "/productos",
  "/carrito",
  "/checkout",
  "/auth",
  "/admin",
  "/admin/slider",
  "/admin/productos",
  "/admin/categorias",
  "/admin/pedidos",
  "/admin/politica-precios",
]);
export function monitoringRoute(value: string): string {
  try {
    const path = new URL(value, "https://store.invalid").pathname.replace(/\/$/, "") || "/";
    if (fixedRoutes.has(path)) return path;
    if (path.startsWith("/producto/")) return "/producto/:slug";
    if (path.startsWith("/api/")) return "/api/:route";
    return "/:route";
  } catch {
    return "/:route";
  }
}
function codeLocation(value?: string): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    if (!["http:", "https:", "file:"].includes(url.protocol)) return undefined;
    // Bundled JS locations are technical assets; other paths may contain order IDs.
    const path = url.pathname;
    if (!/\.(?:[cm]?js|tsx?)(?:$)/.test(path)) return "[location removed]";
    return path.split("/").filter(Boolean).slice(-4).join("/");
  } catch {
    return /\.(?:[cm]?js|tsx?)$/.test(value) ? value.split(/[\\/]/).slice(-2).join("/") : undefined;
  }
}
const errorTypes = new Set([
  "Error",
  "TypeError",
  "ReferenceError",
  "SyntaxError",
  "RangeError",
  "URIError",
  "EvalError",
  "AggregateError",
  "DOMException",
]);
export function privateSentryEvent(
  event: Event,
  surface: "browser" | "server",
  route?: string,
): SentryErrorEvent {
  // Rebuild an allowlist instead of trying to redact arbitrary nested data.
  return {
    type: undefined,
    event_id: event.event_id,
    timestamp: event.timestamp,
    platform: event.platform,
    level: "error",
    environment: event.environment,
    release: event.release,
    message: "Application error (technical location only)",
    tags: { surface, route: monitoringRoute(route ?? "/:route") },
    exception: {
      values: (event.exception?.values ?? []).slice(0, 3).map((value) => ({
        type: errorTypes.has(value.type ?? "") ? value.type : "Error",
        value: "Error capturado; revisar la ubicación técnica.",
        stacktrace: {
          frames: (value.stacktrace?.frames ?? []).slice(-50).map((frame) => ({
            filename: codeLocation(frame.filename),
            abs_path: codeLocation(frame.abs_path),
            function:
              typeof frame.function === "string" && /^[\w$.[\]<> /:-]{1,160}$/.test(frame.function)
                ? frame.function
                : undefined,
            lineno: frame.lineno,
            colno: frame.colno,
            in_app: frame.in_app,
          })),
        },
      })),
    },
  };
}
export function validSentryDsn(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" &&
      !!url.username &&
      !url.password &&
      /^\/\d+$/.test(url.pathname) &&
      /^(?:[a-z0-9-]+\.)*ingest(?:\.[a-z]+)?\.sentry\.io$/i.test(url.hostname)
      ? value
      : undefined;
  } catch {
    return undefined;
  }
}
