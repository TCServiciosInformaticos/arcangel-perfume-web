import { test, expect } from "@playwright/test";
import ExcelJS from "exceljs";
const uid = "55555555-5555-4555-8555-555555555555";
const category = "11111111-1111-4111-8111-111111111111";
const user = {
  id: uid,
  aud: "authenticated",
  role: "authenticated",
  email: "admin@example.invalid",
  created_at: "2026-01-01T00:00:00Z",
  app_metadata: {},
  user_metadata: {},
};
const products = Array.from({ length: 25 }, (_, i) => ({
  id: `fixture-${i}`,
  name: `Artículo ${String(i + 1).padStart(2, "0")}`,
  article_code: `TEST-${i}`,
  category: "Perfumes",
  brand: "Marca fixture",
  stock: i < 2 ? 0 : 2,
  is_active: true,
  created_at: "2026-01-01T00:00:00Z",
  units: i === 0 ? 3 : i === 1 ? 1 : 0,
  revenue: i === 0 ? 300 : i === 1 ? 100 : 0,
}));
const report = {
  current: { revenue: 450, shipping: 50, orders: 2, units: 4, average: 225 },
  previous: { revenue: 300, orders: 1, units: 3, average: 300 },
  daily: [{ day: "2026-10-21", revenue: 450, orders: 2 }],
  products,
  categories: [{ name: "Perfumes", units: 4, revenue: 400 }],
  brands: [{ name: "Marca fixture", units: 4, revenue: 400 }],
  statuses: { paid: 2, abandoned: 1 },
  unverified_orders: 1,
  deleted_product_units: 0,
  generated_at: "2026-10-21T12:00:00Z",
};
test.beforeEach(async ({ context, page }) => {
  await context.route("**/*", (route) =>
    ["127.0.0.1", "localhost"].includes(new URL(route.request().url()).hostname)
      ? route.continue()
      : route.abort(),
  );
  // Only the isolated, local fixture origin receives a synthetic session.
  const encode = (v: object) => Buffer.from(JSON.stringify(v)).toString("base64url");
  const token = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: uid, role: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600 })}.fixture`;
  await page.addInitScript(
    ({ token, user }) =>
      localStorage.setItem(
        "sb-127-auth-token",
        JSON.stringify({
          access_token: token,
          refresh_token: "local-fixture-only",
          token_type: "bearer",
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          expires_in: 3600,
          user,
        }),
      ),
    { token, user },
  );
  await page.route("http://127.0.0.1:4174/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (route.request().method() === "OPTIONS")
      return route.fulfill({
        status: 204,
        headers: {
          "access-control-allow-origin": "http://127.0.0.1:3000",
          "access-control-allow-headers": "*",
          "access-control-allow-methods": "GET,POST,OPTIONS",
        },
      });
    const json =
      path === "/auth/v1/user"
        ? user
        : path === "/rest/v1/user_roles"
          ? { role: "admin" }
          : path === "/rest/v1/rpc/admin_sales_statistics"
            ? report
            : path === "/rest/v1/subcategories"
              ? [
                  {
                    id: "66666666-6666-4666-8666-666666666666",
                    category_id: category,
                    name: "Marca fixture",
                  },
                ]
              : undefined;
    if (json !== undefined)
      return route.fulfill({
        json,
        headers: { "access-control-allow-origin": "http://127.0.0.1:3000" },
      });
    return route.continue();
  });
});
test("sales dashboard displays totals, low sellers and complete stock pagination", async ({
  page,
}) => {
  await page.goto("/admin/estadisticas", { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "Estadísticas", exact: true })).toBeVisible();
  await expect(page.getByText("Total cobrado", { exact: true })).toBeVisible();
  await expect(page.getByText(/sin un intento de pago aprobado coincidente/)).toBeVisible();
  await page.getByRole("button", { name: "Menos vendidos", exact: true }).click();
  const table = page.getByRole("table").filter({ hasText: "Stock actual" });
  await expect(table.locator("tbody tr").first()).toContainText("Artículo 02");
  await page.getByRole("button", { name: "Sin ventas", exact: true }).click();
  await expect(page.getByText("23 artículos", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Alertas de stock", exact: true }).click();
  await expect(page.getByText("25 artículos", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Siguiente", exact: true }).click();
  await expect(page.getByText("Página 2 de 2")).toBeVisible();
  await expect(table.locator("tbody tr")).toHaveCount(5);
  await page.getByLabel("Desde", { exact: true }).fill("2026-10-21");
  await page.getByLabel("Hasta", { exact: true }).fill("2026-10-01");
  await page.getByRole("button", { name: "Aplicar filtros" }).click();
  await expect(page.getByRole("alert")).toContainText("Revisá las fechas");
});
test("Excel export includes all rows beyond the visible page", async ({ page }) => {
  await page.goto("/admin/estadisticas", { waitUntil: "networkidle" });
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Exportar Excel" }).click();
  const download = await downloadPromise;
  const path = await download.path();
  expect(path).toBeTruthy();
  const book = new ExcelJS.Workbook();
  await book.xlsx.readFile(path!);
  expect(book.getWorksheet("Artículos")?.rowCount).toBe(26);
  expect(book.getWorksheet("Resumen")?.getCell("B7").value).toBe(450);
});
