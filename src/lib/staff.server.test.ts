import { test } from "node:test";
import assert from "node:assert/strict";
import { createEmployee } from "./staff.server";
const input = {
  accessToken: "token",
  name: "Empleado fixture",
  email: "Staff@Example.invalid",
  password: "synthetic-password-123",
  modules: ["slider" as const],
};
function fixture(admin: boolean, usersPermission = false) {
  const calls: { created?: object; profile?: object } = {};
  const role = {
    select() {
      return this;
    },
    eq() {
      return this;
    },
    async maybeSingle() {
      return { data: admin ? { role: "admin" } : null, error: null };
    },
  };
  const client = {
    auth: {
      async getUser(token: string) {
        assert.equal(token, "token");
        return { data: { user: { id: "owner-fixture" } }, error: null };
      },
      admin: {
        async createUser(data: object) {
          calls.created = data;
          return { data: { user: { id: "employee-fixture" } }, error: null };
        },
      },
    },
    from(table: string) {
      if (table === "user_roles") return role;
      assert.equal(table, "staff_accounts");
      return {
        select() {
          return this;
        },
        eq() {
          return this;
        },
        async maybeSingle() {
          return {
            data: usersPermission ? { modules: ["usuarios"], enabled: true } : null,
            error: null,
          };
        },
        async insert(data: object) {
          calls.profile = data;
          return { error: null };
        },
      };
    },
  };
  return { client: client as unknown as Parameters<typeof createEmployee>[1], calls };
}
test("nonadmin cannot create auth accounts or grant modules", async () => {
  const f = fixture(false);
  await assert.rejects(createEmployee(input, f.client), /permiso de Usuarios/);
  assert.deepEqual(f.calls, {});
});
test("owner creates a separate employee without administrator role or password metadata", async () => {
  const f = fixture(true);
  assert.deepEqual(await createEmployee(input, f.client), { id: "employee-fixture" });
  assert.deepEqual(f.calls.created, {
    email: "staff@example.invalid",
    password: input.password,
    email_confirm: true,
  });
  assert.deepEqual(f.calls.profile, {
    user_id: "employee-fixture",
    name: input.name,
    email: "staff@example.invalid",
    modules: ["slider"],
    enabled: true,
  });
  assert.ok(!JSON.stringify(f.calls.profile).includes(input.password));
});

test("employee with explicit Usuarios permission can create staff without owner role", async () => {
  const f = fixture(false, true);
  assert.deepEqual(await createEmployee(input, f.client), { id: "employee-fixture" });
  assert.ok(f.calls.created);
});
