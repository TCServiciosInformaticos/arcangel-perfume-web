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
  await page.getByLabel("Archivo Excel de artículos").setInputFiles({
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

test("article review checks photos, filters brands and edits the selected article", async ({
  page,
}) => {
  const brandId = "66666666-6666-4666-8666-666666666666";
  const categoryId = "11111111-1111-4111-8111-111111111111";
  const image = "/review-broken.webp";
  const rows = [
    {
      id: "22222222-2222-4222-8222-222222222222",
      name: "Artículo sin foto",
      article_code: "00001",
      image_urls: [],
      thumbnail_url: null,
      is_active: false,
    },
    {
      id: "33333333-3333-4333-8333-333333333333",
      name: "Artículo con foto fallida",
      article_code: "00002",
      image_urls: [image],
      thumbnail_url: image,
      is_active: true,
    },
  ].map((p) => ({
    ...p,
    slug: p.id,
    description: "Descripción fixture",
    updated_at: "2026-01-01T00:00:00Z",
    price: 0,
    stock: 0,
    compare_at_price: null,
    is_featured: false,
    category_id: categoryId,
    subcategory_id: brandId,
    product_type_id: null,
  }));
  let saved: Record<string, unknown> | undefined;
  await page.route("**/review-broken.webp", (r) => r.fulfill({ status: 404, body: "Missing" }));
  await page.route("http://127.0.0.1:4174/rest/v1/subcategories*", (r) =>
    r.request().method() === "OPTIONS"
      ? r.fallback()
      : r.fulfill({
          json: [{ id: brandId, name: "Marca fixture", category_id: categoryId }],
          headers: { "access-control-allow-origin": "http://127.0.0.1:3000" },
        }),
  );
  await page.route("http://127.0.0.1:4174/rest/v1/products*", async (r) => {
    if (r.request().method() === "OPTIONS") return r.fallback();
    const headers = {
      "access-control-allow-origin": "http://127.0.0.1:3000",
      "content-range": "0-1/2",
    };
    const id = new URL(r.request().url()).searchParams.get("id")?.replace(/^eq\./, "");
    if (r.request().method() === "PATCH") {
      saved = r.request().postDataJSON();
      Object.assign(
        rows.find((p) => p.id === id)!,
        saved,
      );
      return r.fulfill({ json: { id }, headers });
    }
    return r.fulfill({ json: id ? rows.find((p) => p.id === id) : rows, headers });
  });
  await page.route("http://127.0.0.1:4174/storage/v1/**", async (r) => {
    if (r.request().method() === "OPTIONS") return r.fallback();
    const headers = { "access-control-allow-origin": "http://127.0.0.1:3000" };
    if (r.request().method() === "GET")
      return r.fulfill({ path: "public/favicon.png", contentType: "image/png", headers });
    if (new URL(r.request().url()).pathname.includes("/object/sign/"))
      return r.fulfill({
        json: {
          signedURL: `/object/sign/product-images/${r.request().url().split("/").pop()}?token=fixture`,
        },
        headers,
      });
    return r.fulfill({ json: { Key: "product-images/fixture.webp" }, headers });
  });
  await page.goto("/admin/productos?revision=true");
  const panel = page.getByRole("region", { name: "Revisión de artículos" });
  await expect(panel.getByText("Artículo sin foto", { exact: true })).toBeVisible();
  await panel.getByLabel("Marca", { exact: true }).selectOption("Marca fixture");
  await panel.getByRole("button", { name: "Comprobar fotos de esta página" }).click();
  await expect(panel.getByRole("status")).toContainText("Última comprobación: 1 de 1");
  await panel.getByLabel("Problema", { exact: true }).selectOption("failed");
  await expect(panel.getByText("Artículo con foto fallida", { exact: true })).toBeVisible();
  await expect(panel.getByText("Artículo sin foto", { exact: true })).toHaveCount(0);
  await panel.getByRole("button", { name: "Editar artículo", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel("Nombre *", { exact: true })).toHaveValue(
    "Artículo con foto fallida",
  );
  await expect(dialog.getByLabel("Código de artículo", { exact: true })).toHaveValue("00002");
  await dialog.getByLabel("Código de artículo", { exact: true }).fill("NO-GUARDADO");
  await dialog.getByRole("button", { name: "Cancelar", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await panel.getByRole("button", { name: "Editar artículo", exact: true }).click();
  await expect(dialog.getByLabel("Código de artículo", { exact: true })).toHaveValue("00002");
  await dialog.getByLabel("Código de artículo", { exact: true }).fill("000009");
  await dialog.getByLabel("EAN / código de barras", { exact: true }).fill("0001234567890");
  await dialog.locator('input[type="file"][accept="image/*"]').setInputFiles("public/favicon.png");
  await expect(page.getByText("1 imagen(es) subida(s)", { exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "Quitar imagen", exact: true }).first().click();
  await dialog.getByRole("button", { name: "Guardar cambios", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(saved?.article_code).toBe("000009");
  expect(saved?.barcode).toBe("0001234567890");
  expect(saved?.image_urls).toHaveLength(1);
  expect(String(saved?.thumbnail_url)).toContain("product-images");
  expect(saved?.price).toBe(0);
  expect(saved?.stock).toBe(0);
  expect(saved?.is_active).toBe(true);
  await panel.getByLabel("Problema", { exact: true }).selectOption("missing");
  await expect(panel.getByText("Artículo sin foto", { exact: true })).toBeVisible();
  await expect(panel.getByText("Artículo con foto fallida", { exact: true })).toHaveCount(0);
});
