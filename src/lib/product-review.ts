export type ReviewProduct = {
  id: string;
  name: string;
  article_code: string | null;
  subcategory_id: string | null;
  price: number;
  stock: number;
  is_active: boolean;
  image_urls: string[];
  thumbnail_url: string | null;
};
export type ImageCheck = { status: "ok" | "failed"; checkedAt: number };
export type ImageChecks = Record<string, ImageCheck>;
export type ReviewIssue = "all" | "missing" | "failed" | "unchecked" | "code" | "price" | "stock";
export const CHECK_TTL = 30 * 60 * 1000;
export function productImageUrls(p: Pick<ReviewProduct, "image_urls" | "thumbnail_url">) {
  return [
    ...new Set([p.thumbnail_url, ...(p.image_urls ?? [])].filter((u): u is string => !!u?.trim())),
  ];
}
export function currentImageCheck(checks: ImageChecks, url: string, now = Date.now()) {
  const check = checks[url];
  return check && now - check.checkedAt < CHECK_TTL ? check : undefined;
}
export function reviewIssues(
  p: ReviewProduct,
  checks: ImageChecks,
  now = Date.now(),
): ReviewIssue[] {
  const urls = productImageUrls(p);
  const issues: ReviewIssue[] = [];
  if (!(p.image_urls ?? []).some((u) => u?.trim())) issues.push("missing");
  if (urls.some((url) => currentImageCheck(checks, url, now)?.status === "failed"))
    issues.push("failed");
  if (urls.some((url) => !currentImageCheck(checks, url, now))) issues.push("unchecked");
  if (!p.article_code?.trim()) issues.push("code");
  if (Number(p.price) === 0) issues.push("price");
  if (p.stock === 0) issues.push("stock");
  return issues;
}
/** Load as an image: no CORS fetch, credentials or server-side URL requests. */
export function probeImage(url: string, signal: AbortSignal, timeoutMs = 8000): Promise<boolean> {
  return new Promise((resolve) => {
    if (signal.aborted) return resolve(false);
    let parsed: URL;
    try {
      parsed = new URL(url, window.location.origin);
    } catch {
      return resolve(false);
    }
    if (!["https:", "http:"].includes(parsed.protocol)) return resolve(false);
    const image = new Image();
    const finish = (ok: boolean) => {
      clearTimeout(timer);
      signal.removeEventListener("abort", abort);
      image.onload = null;
      image.onerror = null;
      image.removeAttribute("src");
      resolve(ok);
    };
    const abort = () => finish(false);
    const timer = setTimeout(() => finish(false), timeoutMs);
    image.referrerPolicy = "no-referrer";
    image.onload = () => finish(image.naturalWidth > 0 && image.naturalHeight > 0);
    image.onerror = () => finish(false);
    signal.addEventListener("abort", abort, { once: true });
    image.src = parsed.href;
  });
}
/** Failed images get a second attempt; cancellation never records a failure. */
export async function checkImageBatch(
  urls: string[],
  signal: AbortSignal,
  onResult: (url: string, check: ImageCheck) => void,
  probe = probeImage,
) {
  const queue = [...new Set(urls)];
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(3, queue.length) }, async () => {
      while (!signal.aborted && next < queue.length) {
        const url = queue[next++];
        let ok = await probe(url, signal);
        if (!ok && !signal.aborted) ok = await probe(url, signal);
        if (signal.aborted) return;
        onResult(url, { status: ok ? "ok" : "failed", checkedAt: Date.now() });
      }
    }),
  );
}
