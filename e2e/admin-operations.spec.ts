import { test, expect, type Page } from "@playwright/test";
import { exportProductExcel } from "../src/lib/product-excel";
const uid = "55555555-5555-4555-8555-555555555555";
async function setup(page: Page) {
  const user = {
    id: uid,
    aud: "authenticated",
    role: "authenticated",
    email: "admin@example.invalid",
    created_at: "2026-01-01T00:00:00Z",
    app_metadata: {},
    user_metadata: {},
  };
  const enc = (v: object) => Buffer.from(JSON.stringify(v)).toString("base64url");
  const token = `${enc({ alg: "HS256", typ: "JWT" })}.${enc({ sub: uid, role: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600 })}.fixture`;
  await page
    .context()
    .route("**/*", (r) =>
      ["localhost", "127.0.0.1"].includes(new URL(r.request().url()).hostname)
        ? r.continue()
        : r.abort(),
    );
  await page.addInitScript(
    ({ user, token }) =>
      localStorage.setItem(
        "sb-127-auth-token",
        JSON.stringify({
          access_token: token,
          refresh_token: "fixture",
          token_type: "bearer",
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          expires_in: 3600,
          user,
        }),
      ),
    { user, token },
  );
  await page.route("http://127.0.0.1:4174/**", async (r) => {
    const path = new URL(r.request().url()).pathname;
    const headers = {
      "access-control-allow-origin": "http://127.0.0.1:3000",
      "access-control-allow-headers": "*",
      "access-control-allow-methods": "GET,POST,OPTIONS",
    };
    if (r.request().method() === "OPTIONS") return r.fulfill({ status: 204, headers });
    if (path === "/auth/v1/user") return r.fulfill({ json: user, headers });
    if (path === "/rest/v1/user_roles") return r.fulfill({ json: { role: "admin" }, headers });
    if (path === "/rest/v1/admin_change_log")
      return r.fulfill({
        headers: { ...headers, "content-range": "0-0/1" },
        json: [
          {
            id: "audit",
            occurred_at: "2026-10-22T12:00:00Z",
            actor_name: "Empleado fixture",
            actor_id: uid,
            entity: "products",
            record_id: "product-fixture",
            record_name: "Perfume auditado",
            operation: "UPDATE",
            source: "excel",
            changes: { price: { before: 100, after: 145 } },
          },
        ],
      });
    if (path === "/rest/v1/rpc/admin_customer_list")
      return r.fulfill({
        headers,
        json: {
          total: 1,
          rows: [
            {
              email: "client@example.invalid",
              name: "Cliente fixture",
              whatsapp: "000",
              orders: 2,
              paid_orders: 1,
              spent: 110,
              last_order: "2026-10-22T12:00:00Z",
              unpaid_orders: 1,
            },
          ],
        },
      });
    if (path === "/rest/v1/rpc/admin_customer_orders")
      return r.fulfill({
        headers,
        json: {
          total: 1,
          rows: [
            {
              id: "order",
              order_number: 123,
              status: "paid",
              created_at: "2026-10-22T12:00:00Z",
              total: 110,
              verified: true,
              items: [{ name: "Perfume comprado", quantity: 1, total: 100 }],
            },
          ],
        },
      });
    if (path === "/rest/v1/rpc/admin_business_alerts") {
      const kind = r.request().postDataJSON().kind;
      return r.fulfill({
        headers,
        json: {
          counts: { sin_stock: 1, precio_cero: 1 },
          rows: [
            {
              id: "alert",
              kind,
              label: kind === "precio_cero" ? "Artículo con precio cero" : "Artículo agotado",
              detail: kind === "precio_cero" ? "Precio de venta en cero" : "Stock actual: 0",
              route: "/admin/productos",
            },
          ],
        },
      });
    }
    return r.continue();
  });
}
test.beforeEach(async ({ page }) => setup(page));
test("history shows actor and before/after values", async ({ page }) => {
  await page.goto("/admin/historial");
  await expect(
    page.getByRole("heading", { name: "Historial de cambios", exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/Empleado fixture/)).toBeVisible();
  await page.getByText("Ver 1 campo(s) modificado(s)").click();
  await expect(page.getByRole("cell", { name: "100", exact: true })).toBeVisible();
  await expect(page.getByRole("cell", { name: "145", exact: true })).toBeVisible();
});
test("customer purchase detail uses verified payment labels", async ({ page }) => {
  await page.goto("/admin/clientes");
  await page.getByRole("button", { name: "Ver compras de Cliente fixture" }).click();
  await expect(page.getByText("Pedido #123", { exact: false })).toBeVisible();
  await expect(page.getByText("1 × Perfume comprado", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Cerrar detalle" }).click();
  await expect(page.getByRole("heading", { name: "Compras de Cliente fixture" })).toHaveCount(0);
});
test("business alert cards filter the detail list", async ({ page }) => {
  await page.goto("/admin/alertas");
  await expect(page.getByText("Artículo agotado", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /Precio en cero/ }).click();
  await expect(page.getByText("Artículo con precio cero", { exact: true })).toBeVisible();
  await expect(page.getByText("Artículo agotado", { exact: true })).toHaveCount(0);
});
const excelProducts = [
  {
    id: "22222222-2222-4222-8222-222222222222",
    name: "Perfume de prueba",
    price: 1100,
    stock: 2,
    is_active: true,
    article_code: "FIXTURE",
  },
  {
    id: "33333333-3333-4333-8333-333333333333",
    name: "Producto agotado de prueba",
    price: 2100,
    stock: 0,
    is_active: true,
    article_code: "FIXTURE-2",
  },
];
test("Excel preview saves only selected changes with snapshot versions", async ({ page }) => {
  let saved: { rows: { id: string; expected_updated_at: string }[] } | undefined;
  await page.route("http://127.0.0.1:4174/rest/v1/rpc/admin_apply_product_preview", async (r) => {
    if (r.request().method() === "OPTIONS") return r.fallback();
    saved = r.request().postDataJSON();
    return r.fulfill({
      json: 1,
      headers: { "access-control-allow-origin": "http://127.0.0.1:3000" },
    });
  });
  await page.goto("/admin/productos");
  const buffer = await exportProductExcel(excelProducts, []);
  await page
    .getByLabel("Archivo Excel de artículos")
    .setInputFiles({
      name: "fixture.xlsx",
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      buffer: Buffer.from(buffer),
    });
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("Seleccionados: 2 de 2", { exact: false })).toBeVisible();
  await dialog
    .getByRole("checkbox", { name: "Aplicar cambios de Producto agotado de prueba", exact: true })
    .uncheck();
  await dialog.getByRole("button", { name: "Aplicar cambios (1)", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(saved?.rows).toHaveLength(1);
  expect(saved?.rows[0].id).toBe(excelProducts[0].id);
  expect(saved?.rows[0].expected_updated_at).toBe("2026-01-01T00:00:00Z");
});
