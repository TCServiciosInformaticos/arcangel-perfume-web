import { test, expect } from "@playwright/test";
const bundle = {
  id: "77777777-7777-4777-8777-777777777777",
  name: "Kit de prueba",
  description: "Combo ficticio",
  price: 1500,
  stock: 2,
  components: [
    { product_id: "22222222-2222-4222-8222-222222222222", name: "Artículo A", quantity: 1 },
    { product_id: "33333333-3333-4333-8333-333333333333", name: "Artículo B", quantity: 1 },
  ],
};
test.beforeEach(async ({ context, page }) => {
  await context.route("**/*", (route) =>
    ["127.0.0.1", "localhost"].includes(new URL(route.request().url()).hostname)
      ? route.continue()
      : route.abort(),
  );
  await page.route("http://127.0.0.1:4174/rest/v1/rpc/list_store_bundles", (route) =>
    route.fulfill({
      status: route.request().method() === "OPTIONS" ? 204 : 200,
      json: route.request().method() === "OPTIONS" ? undefined : [bundle],
      headers: {
        "access-control-allow-origin": "http://127.0.0.1:3000",
        "access-control-allow-headers": "*",
        "access-control-allow-methods": "GET,POST,OPTIONS",
      },
    }),
  );
});
test("favorites persist and can be removed without changing the cart", async ({ page }) => {
  await page.goto("/productos", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Guardar en favoritos" }).first().click();
  await expect
    .poll(() =>
      page.evaluate(() => JSON.parse(localStorage.getItem("arcangel-favorites-v1") ?? "[]").length),
    )
    .toBe(1);
  await page.goto("/favoritos", { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "Mis favoritos", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Quitar de favoritos" }).first().click();
  await expect(page.getByText("Todavía no guardaste artículos.", { exact: false })).toBeVisible();
  expect(
    await page.evaluate(() => JSON.parse(localStorage.getItem("arcangel-cart-v1") ?? "[]").length),
  ).toBe(0);
});
test("bundle adds with its own price and limits quantity to component stock", async ({ page }) => {
  await page.goto("/combos", { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "Kit de prueba" })).toBeVisible();
  await page.getByRole("button", { name: "Agregar combo" }).click();
  await expect
    .poll(() =>
      page.evaluate(() => JSON.parse(localStorage.getItem("arcangel-cart-v1") ?? "[]").length),
    )
    .toBe(1);
  await page.goto("/carrito", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Sumar", exact: true }).click();
  await page.getByRole("button", { name: "Sumar", exact: true }).click();
  await expect
    .poll(() =>
      page.evaluate(() => JSON.parse(localStorage.getItem("arcangel-cart-v1") ?? "[]")[0].quantity),
    )
    .toBe(2);
  await page.getByRole("link", { name: "Kit de prueba", exact: true }).click();
  await expect(page).toHaveURL(/\/combos$/);
});
test("new commerce admin requires authentication and preserves return path", async ({ page }) => {
  await page.goto("/admin/herramientas", { waitUntil: "networkidle" });
  await expect(page).toHaveURL(/\/auth\?/);
  expect(new URL(page.url()).searchParams.get("next")).toBe("/admin/herramientas");
  await expect(page.getByRole("heading", { name: "Herramientas de venta" })).toHaveCount(0);
});
