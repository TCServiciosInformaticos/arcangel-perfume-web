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
test("catalog fetches and displays only one page at a time", async ({ page }) => {
  await page.goto("/productos?q=fixture-paginacion", { waitUntil: "networkidle" });
  await expect(page.locator("main h3")).toHaveCount(24);
  await expect(
    page.getByRole("heading", { name: "Fixture paginación 1", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Siguiente", exact: true }).click();
  await expect(page).toHaveURL(/pagina=2/);
  await expect(
    page.getByRole("heading", { name: "Fixture paginación 25", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Fixture paginación 1", exact: true }),
  ).toHaveCount(0);
  await expect(page.locator("main h3")).toHaveCount(24);
});
test("hero loads only neighboring slides and prioritizes the first image", async ({ page }) => {
  const names = [
    "hero-banner-red",
    "hero-ofertas",
    "hero-perfumes-bodegon",
    "hero-limpieza",
    "hero-cabello-vanity",
    "hero-higiene",
    "hero-accesorios",
    "hero-skincare",
    "hero-makeup",
  ];
  await page.route("http://127.0.0.1:4174/rest/v1/home_slides*", (route) =>
    route.fulfill({
      json: names.map((n, i) => ({
        id: String(i),
        title: `Slide ${i + 1}`,
        subtitle: "Fixture",
        image_path: `builtin:${n}`,
        mobile_position: 50,
        destination: "catalog",
        category: null,
      })),
      headers: { "access-control-allow-origin": "http://127.0.0.1:3000" },
    }),
  );
  await page.goto("/", { waitUntil: "networkidle" });
  const hero = page.getByRole("region", { name: "Destacados de El Arcángel" });
  await expect(hero).toBeVisible();
  await expect(hero.locator("img")).toHaveCount(3);
  await expect(hero.locator('img[fetchpriority="high"]')).toHaveCount(1);
  await hero.getByRole("button", { name: "Ver diapositiva 5: Slide 5", exact: true }).click();
  await expect(
    hero.getByRole("button", { name: "Ver diapositiva 5: Slide 5", exact: true }),
  ).toHaveAttribute("aria-current", "true");
  await expect(hero.locator("img")).toHaveCount(6);
});

test("product detail shows a replacement when its photo cannot load", async ({ page }) => {
  await page.route("**/broken-product-photo.webp", (route) =>
    route.fulfill({ status: 404, body: "Missing" }),
  );
  await page.goto("/producto/foto-fallida-prueba");
  await expect(
    page.getByRole("img", { name: "Perfume de prueba: imagen no disponible", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Agregar al carrito" })).toBeVisible();
});
