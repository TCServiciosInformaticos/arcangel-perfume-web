import { test, expect } from "@playwright/test";
test.beforeEach(async ({ context, page }) => {
  page.on("pageerror", (error) => console.error("Browser JavaScript:", error.message));
  // Block external browser traffic: fixtures are local, no live payments/email/DB.
  await context.route("**/*", (route) => {
    const url = new URL(route.request().url());
    return ["127.0.0.1", "localhost"].includes(url.hostname) ? route.continue() : route.abort();
  });
});
test("catalog search updates the URL and filters products", async ({ page }) => {
  await page.goto("/productos", { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "Perfume de prueba", exact: true })).toBeVisible();
  await page.getByPlaceholder("Buscar producto…").fill("agotado");
  await expect(page).toHaveURL(/q=agotado/);
  await expect(
    page.getByRole("heading", { name: "Producto agotado de prueba", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Perfume de prueba", exact: true })).toHaveCount(
    0,
  );
});
test("cart persists, limits quantity to stock and can remove an item", async ({ page }) => {
  await page.goto("/producto/perfume-prueba", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Agregar al carrito" }).click();
  await expect
    .poll(() =>
      page.evaluate(() => JSON.parse(localStorage.getItem("arcangel-cart-v1") ?? "[]").length),
    )
    .toBe(1);
  await page.goto("/carrito", { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "Tu carrito", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Sumar", exact: true }).click();
  await page.getByRole("button", { name: "Sumar", exact: true }).click();
  const item = page.locator("main li").filter({ hasText: "Perfume de prueba" });
  await expect(item.getByText("2", { exact: true })).toBeVisible();
  await page.reload({ waitUntil: "networkidle" });
  await expect(item.getByText("2", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Eliminar", exact: true }).click();
  await expect(page.getByText("Todavía está vacío")).toBeVisible();
});
test("out-of-stock product cannot be added to cart", async ({ page }) => {
  await page.goto("/producto/agotado-prueba", { waitUntil: "networkidle" });
  await expect(page.getByText("Producto sin stock por el momento.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Agregar al carrito" })).toHaveCount(0);
});
test("slider admin requires sign-in", async ({ page }) => {
  await page.goto("/admin/slider?vista=prueba", { waitUntil: "networkidle" });
  await expect(page).toHaveURL(/\/auth/);
  expect(new URL(page.url()).searchParams.get("next")).toBe("/admin/slider?vista=prueba");
  await expect(page.getByRole("heading", { name: "Slider de inicio" })).toHaveCount(0);
});
test("purchase wording explains the handoff to Mercado Pago", async ({ page }) => {
  await page.goto("/producto/perfume-prueba", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Agregar al carrito" }).click();
  await page.goto("/carrito");
  await page.getByRole("link", { name: "Continuar con la compra", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Finalizá tu compra", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Continuar a Mercado Pago", exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/Te llevaremos a Mercado Pago para elegir cómo pagar/)).toBeVisible();
  await expect(page.getByText(/dueño/)).toHaveCount(0);
});
