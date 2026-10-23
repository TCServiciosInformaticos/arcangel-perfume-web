import { test, expect } from "@playwright/test";
const uid = "55555555-5555-4555-8555-555555555555";
async function session(page: import("@playwright/test").Page, owner: boolean) {
  const user = {
    id: uid,
    aud: "authenticated",
    role: "authenticated",
    email: "staff@example.invalid",
    created_at: "2026-01-01T00:00:00Z",
    app_metadata: {},
    user_metadata: {},
  };
  const enc = (v: object) => Buffer.from(JSON.stringify(v)).toString("base64url");
  const token = `${enc({ alg: "HS256", typ: "JWT" })}.${enc({ sub: uid, role: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600 })}.fixture`;
  await page
    .context()
    .route("**/*", (route) =>
      ["localhost", "127.0.0.1"].includes(new URL(route.request().url()).hostname)
        ? route.continue()
        : route.abort(),
    );
  await page.addInitScript(
    ({ token, user }) =>
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
    { token, user },
  );
  await page.route("http://127.0.0.1:4174/**", async (route) => {
    const p = new URL(route.request().url()).pathname;
    const headers = {
      "access-control-allow-origin": "http://127.0.0.1:3000",
      "access-control-allow-headers": "*",
      "access-control-allow-methods": "GET,POST,OPTIONS",
    };
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers });
    if (p === "/auth/v1/user") return route.fulfill({ json: user, headers });
    if (p === "/rest/v1/user_roles")
      return route.fulfill({ json: owner ? { role: "admin" } : null, headers });
    if (p === "/rest/v1/staff_accounts")
      return route.fulfill({ json: owner ? [] : { modules: ["slider"], enabled: true }, headers });
    return route.continue();
  });
}
test("employee sees assigned module and cannot open users directly", async ({ page }) => {
  await session(page, false);
  await page.goto("/admin");
  await expect(page.getByRole("link", { name: "Slider", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Usuarios", exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Productos", exact: true })).toHaveCount(0);
  await page.goto("/admin/usuarios");
  await expect(page.getByRole("button", { name: "Crear empleado" })).toHaveCount(0);
  await expect(page.getByText("No tenés permiso para acceder a este módulo.")).toBeVisible();
});
test("owner can configure employee modules in Users", async ({ page }) => {
  await session(page, true);
  await page.goto("/admin/usuarios");
  await expect(page.getByRole("heading", { name: "Usuarios", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Crear empleado" })).toBeVisible();
  await expect(page.getByRole("checkbox")).toHaveCount(12);
  await page.getByRole("checkbox", { name: "Productos", exact: true }).check();
  await expect(page.getByRole("checkbox", { name: "Categorías", exact: true })).not.toBeChecked();
  await expect(
    page.getByRole("checkbox", { name: "Política de Precios", exact: true }),
  ).not.toBeChecked();
  await page.getByRole("checkbox", { name: /Slider/ }).check();
  await expect(page.getByRole("checkbox", { name: /Slider/ })).toBeChecked();
  await expect(page.getByText("Todavía no hay empleados creados.")).toBeVisible();
});
