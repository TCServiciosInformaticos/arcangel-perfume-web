import { test } from "node:test";
import assert from "node:assert/strict";
import {
  checkImageBatch,
  reviewIssues,
  productImageUrls,
  CHECK_TTL,
  type ReviewProduct,
} from "./product-review";
const p: ReviewProduct = {
  id: "one",
  name: "Artículo",
  article_code: "00001",
  subcategory_id: null,
  price: 0,
  stock: 0,
  is_active: true,
  image_urls: ["/a.webp", "/a.webp"],
  thumbnail_url: "/a.webp",
};
test("review distinguishes missing full photos, zero values and unchecked or failed URLs", () => {
  assert.deepEqual(productImageUrls(p), ["/a.webp"]);
  assert.deepEqual(reviewIssues(p, {}), ["unchecked", "price", "stock"]);
  const now = Date.now();
  assert.deepEqual(reviewIssues(p, { "/a.webp": { status: "ok", checkedAt: now } }, now), [
    "price",
    "stock",
  ]);
  assert.deepEqual(reviewIssues(p, { "/a.webp": { status: "failed", checkedAt: now } }, now), [
    "failed",
    "price",
    "stock",
  ]);
  assert.ok(
    reviewIssues(p, { "/a.webp": { status: "failed", checkedAt: now - CHECK_TTL } }, now).includes(
      "unchecked",
    ),
  );
  assert.ok(
    !reviewIssues(p, { "/a.webp": { status: "failed", checkedAt: now - CHECK_TTL } }, now).includes(
      "failed",
    ),
  );
  assert.ok(reviewIssues({ ...p, image_urls: [], article_code: " " }, {}).includes("missing"));
  assert.ok(reviewIssues({ ...p, image_urls: [], article_code: " " }, {}).includes("code"));
  assert.equal(p.price, 0);
  assert.equal(p.is_active, true);
});
test("batch deduplicates images, retries failures and limits concurrent checks", async () => {
  let active = 0,
    max = 0;
  const calls: Record<string, number> = {};
  const result: Record<string, string> = {};
  await checkImageBatch(
    ["ok", "retry", "broken", "extra", "ok"],
    new AbortController().signal,
    (url, check) => {
      result[url] = check.status;
    },
    async (url) => {
      active++;
      max = Math.max(max, active);
      calls[url] = (calls[url] ?? 0) + 1;
      await new Promise((r) => setTimeout(r, 5));
      active--;
      return url !== "broken" && (url !== "retry" || calls[url] === 2);
    },
  );
  assert.ok(max <= 3);
  assert.deepEqual(result, { ok: "ok", extra: "ok", retry: "ok", broken: "failed" });
  assert.deepEqual(calls, { ok: 1, retry: 2, broken: 2, extra: 1 });
});
test("cancelled probes do not record false failures or schedule more work", async () => {
  const controller = new AbortController();
  let calls = 0,
    recorded = 0;
  await checkImageBatch(
    ["a", "b", "c", "d"],
    controller.signal,
    () => {
      recorded++;
    },
    async () => {
      calls++;
      controller.abort();
      return false;
    },
  );
  assert.equal(recorded, 0);
  assert.equal(calls, 1);
});
