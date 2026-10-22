import type { StaffModule } from "./staff-permissions";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { SupabaseClient } from "@supabase/supabase-js";
export async function createEmployee(
  input: {
    accessToken: string;
    name: string;
    email: string;
    password: string;
    modules: StaffModule[];
  },
  client: typeof supabaseAdmin = supabaseAdmin,
) {
  const auth = await client.auth.getUser(input.accessToken);
  if (auth.error || !auth.data.user) throw new Error("Sesión inválida.");
  const role = await client
    .from("user_roles")
    .select("role")
    .eq("user_id", auth.data.user.id)
    .eq("role", "admin")
    .maybeSingle();
  if (role.error || !role.data) throw new Error("Solo el administrador puede crear empleados.");
  const created = await client.auth.admin.createUser({
    email: input.email.toLowerCase(),
    password: input.password,
    email_confirm: true,
  });
  if (created.error || !created.data.user)
    throw new Error(
      "No se pudo crear la cuenta. Verificá que el correo no esté registrado y que la contraseña cumpla los requisitos.",
    );
  // Never grant the administrator role. No invitations or email are sent here.
  const db = client as unknown as SupabaseClient;
  const saved = await db
    .from("staff_accounts")
    .insert({
      user_id: created.data.user.id,
      name: input.name,
      email: input.email.toLowerCase(),
      modules: input.modules,
      enabled: true,
    });
  if (saved.error)
    throw new Error(
      "La cuenta fue creada, pero no se habilitó su acceso de empleado. Contactá al administrador antes de volver a intentarlo.",
    );
  return { id: created.data.user.id };
}
