import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { STAFF_MODULES } from "./staff-permissions";
export const createStaffAccount = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({
        accessToken: z.string().min(20),
        name: z.string().trim().min(2).max(120),
        email: z.string().trim().email().max(254),
        password: z.string().min(12).max(128),
        modules: z.array(z.enum(STAFF_MODULES)).max(STAFF_MODULES.length),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY)
      throw new Error(
        "Falta configurar SUPABASE_SERVICE_ROLE_KEY en el servidor de Hostinger para crear cuentas. No pegues esa clave en este formulario.",
      );
    const { createEmployee } = await import("./staff.server");
    return createEmployee(data);
  });
